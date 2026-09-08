import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { newRecord, snapshot } from '../src/domain.js'
const OWNER = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222', TEMP = '33333333-3333-4333-8333-333333333333'
const DOC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

test('フォローとカードメモのSQL権限', async t => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, is_anonymous boolean, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('${OWNER}',false,now()),('${OTHER}',false,now()),('${TEMP}',true,null);
      create table public.notes(id uuid primary key, user_id uuid not null references auth.users(id), title text, blocks jsonb);
      insert into notes values ('${DOC}','${OWNER}','DRAFT','[]');
      alter table notes enable row level security;
      grant select,insert,update,delete on notes to authenticated;
      create policy notes_owner on notes to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/20260907034224_nitoron_publications_and_feedback.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/migrations/20260908114500_nitoron_free_input_publication.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/migrations/20260908153322_nitoron_follows_and_card_memos.sql', import.meta.url), 'utf8'))
    const as = async (user, sql, params = []) => {
      await db.exec(`set role ${user ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${user || ''}', false);`)
      try { return await db.query(sql, params) } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);") }
    }
    const r = newRecord(); r.id = DOC; r.title = 'ブロッコリーの発表'
    await as(OWNER, 'insert into nitoron_publications(id,owner_id,snapshot,is_public) values($1,$2,$3,true)', [DOC, OWNER, snapshot(r)])

    await t.test('フォローは本人だけが読め、なりすまし・自己フォロー・発表なしの相手を拒否', async () => {
      const follow = 'insert into nitoron_follows(follower_id,owner_id) values($1,$2)'
      await as(OTHER, follow, [OTHER, OWNER])
      assert.equal((await as(OTHER, 'select * from nitoron_follows')).rows.length, 1)
      assert.equal((await as(OWNER, 'select * from nitoron_follows')).rows.length, 0)
      await assert.rejects(as(null, 'select * from nitoron_follows'))
      await assert.rejects(as(OWNER, follow, [OTHER, OWNER]))
      await assert.rejects(as(OTHER, follow, [OTHER, OTHER]))
      await assert.rejects(as(OWNER, follow, [OWNER, TEMP]))
      assert.equal((await as(OTHER, 'delete from nitoron_follows where owner_id=$1 returning follower_id', [OWNER])).rows.length, 1)
    })
    await t.test('カードメモは本人だけが読み書きでき、なりすましと空・上限超過を拒否', async () => {
      const memo = 'insert into nitoron_card_memos(user_id,publication_id,body) values($1,$2,$3)'
      await as(OTHER, memo, [OTHER, DOC, '同じ条件で試す'])
      assert.equal((await as(OTHER, 'select * from nitoron_card_memos')).rows.length, 1)
      assert.equal((await as(OWNER, 'select * from nitoron_card_memos')).rows.length, 0)
      await assert.rejects(as(null, 'select * from nitoron_card_memos'))
      await assert.rejects(as(OWNER, memo, [OTHER, DOC, 'なりすまし']))
      await assert.rejects(as(OWNER, memo, [OWNER, DOC, '  ']))
      await assert.rejects(as(OWNER, memo, [OWNER, DOC, 'あ'.repeat(2001)]))
      const before = (await as(OTHER, 'select updated_at from nitoron_card_memos')).rows[0].updated_at
      await as(OTHER, 'update nitoron_card_memos set body=$1 where publication_id=$2', ['育苗の日数も控える', DOC])
      const row = (await as(OTHER, 'select body,updated_at from nitoron_card_memos')).rows[0]
      assert.equal(row.body, '育苗の日数も控える')
      assert.ok(new Date(row.updated_at) >= new Date(before))
      await assert.rejects(as(OTHER, 'update nitoron_card_memos set user_id=$1 where publication_id=$2', [OWNER, DOC]))
    })
    await t.test('公開停止後は新しいメモを追加できないが、既存メモは本人に残る', async () => {
      await as(OWNER, 'update nitoron_publications set is_public=false where id=$1', [DOC])
      await assert.rejects(as(TEMP, 'insert into nitoron_card_memos(user_id,publication_id,body) values($1,$2,$3)', [TEMP, DOC, '後で読む']))
      assert.equal((await as(OTHER, 'select * from nitoron_card_memos')).rows.length, 1)
    })
  } finally { await db.close() }
})
