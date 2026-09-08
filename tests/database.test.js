import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { newRecord, snapshot } from '../src/domain.js'
const OWNER = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222', TEMP = '33333333-3333-4333-8333-333333333333'
const DOC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', TEMP_DOC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

test('PostgreSQLで公開・停止・指摘・所有者制御を検証', async t => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, is_anonymous boolean, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('${OWNER}',false,now()),('${OTHER}',false,now()),('${TEMP}',true,null);
      create table public.notes(id uuid primary key, user_id uuid not null references auth.users(id), title text, blocks jsonb);
      insert into notes values ('${DOC}','${OWNER}','PRIVATE DRAFT','[]'),('${TEMP_DOC}','${TEMP}','TEMP','[]');
      alter table notes enable row level security;
      grant select,insert,update,delete on notes to authenticated;
      create policy notes_owner on notes to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/20260907034224_nitoron_publications_and_feedback.sql', import.meta.url), 'utf8'))
    const as = async (user, sql, params = []) => {
      await db.exec(`set role ${user ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${user || ''}', false);`)
      try { return await db.query(sql, params) } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);") }
    }
    const r = newRecord(); r.id = DOC; r.title = 'ＢＲＯＣＣＯＬＩ'; Object.assign(r.meta, { author: '発表者', crop: 'ブロッコリー', summary: '公開する内容だけ', observations: [{ fact: '計測Ａ１２' }] })
    await t.test('他人の下書きは見えず、別人による公開も拒否', async () => {
      assert.equal((await as(OTHER, 'select * from notes')).rows.length, 0)
      await assert.rejects(as(OTHER, 'insert into nitoron_publications(id,owner_id,snapshot,is_public) values($1,$2,$3,true)', [DOC, OTHER, snapshot(r)]))
    })
    await t.test('匿名の仮アカウントは自分の記録でも公開できない', async () => {
      const temp = { ...snapshot(r), id: TEMP_DOC }
      await assert.rejects(as(TEMP, 'insert into nitoron_publications(id,owner_id,snapshot,is_public) values($1,$2,$3,true)', [TEMP_DOC, TEMP, temp]))
    })
    await t.test('確認済みの所有者は公開でき、訪問者は公開版だけ読める', async () => {
      await as(OWNER, 'insert into nitoron_publications(id,owner_id,snapshot,is_public) values($1,$2,$3,true)', [DOC, OWNER, snapshot(r)])
      const rows = (await as(null, 'select * from nitoron_publications')).rows
      assert.equal(rows.length, 1); assert.equal(rows[0].snapshot.meta.summary, '公開する内容だけ')
      assert.equal(JSON.stringify(rows).includes('PRIVATE DRAFT'), false)
      assert.ok(rows[0].search_text.includes('broccoli')); assert.ok(rows[0].search_text.includes('ぶろっこりー')); assert.ok(rows[0].search_text.includes('計測a12'))
    })
    await t.test('他人の公開版を変更・所有権移転できない', async () => {
      assert.equal((await as(OTHER, 'update nitoron_publications set is_public=false returning id')).rows.length, 0)
      await assert.rejects(as(OWNER, 'update nitoron_publications set owner_id=$1 where id=$2', [OTHER, DOC]))
    })
    await t.test('未確認・なりすまし投稿を拒否し、確認済み本人の指摘を保存', async () => {
      const sql = 'insert into nitoron_feedback(publication_id,user_id,author,kind,section,body) values($1,$2,$3,$4,$5,$6) returning id'
      const args = [DOC, OTHER, '質問者', '質問', '結果', '収穫率の母数は何株ですか？']
      await assert.rejects(as(TEMP, sql, [DOC, TEMP, ...args.slice(2)]))
      await assert.rejects(as(OTHER, sql, [DOC, OWNER, ...args.slice(2)]))
      await as(OTHER, sql, args)
      assert.equal((await as(null, 'select * from nitoron_feedback')).rows.length, 1)
      await assert.rejects(as(OTHER, sql, args))
    })
    await t.test('下書きを編集しても公開版は変わらない', async () => {
      await as(OWNER, "update notes set title='NEW PRIVATE DRAFT' where id=$1", [DOC])
      assert.equal((await as(null, 'select snapshot from nitoron_publications')).rows[0].snapshot.title, 'ＢＲＯＣＣＯＬＩ')
    })
    await t.test('公開停止で発表・指摘が訪問者と他の利用者から消え、所有者には残る', async () => {
      await as(OWNER, 'update nitoron_publications set is_public=false where id=$1', [DOC])
      for (const who of [null, OTHER]) { assert.equal((await as(who, 'select * from nitoron_publications')).rows.length, 0); assert.equal((await as(who, 'select * from nitoron_feedback')).rows.length, 0) }
      assert.equal((await as(OWNER, 'select * from nitoron_feedback')).rows.length, 1)
    })
    await t.test('公開者は指摘を削除でき、公開APIから内部のレート制限・認証表を読めない', async () => {
      assert.equal((await as(OWNER, 'delete from nitoron_feedback returning id')).rows.length, 1)
      await assert.rejects(as(OTHER, 'select * from nitoron_private.feedback_limits'))
      await assert.rejects(as(null, 'select * from auth.users'))
      const privilege = await db.query("select has_function_privilege('anon','nitoron_private.is_verified()','execute') as allowed")
      assert.equal(privilege.rows[0].allowed, false)
    })
  } finally { await db.close() }
})
