import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { newRecord, snapshot } from '../src/domain.js'
const OWNER = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222'
const ORIGIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', MINE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', MINE_PRIVATE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', OTHERS = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
test('「試した結果」の実践記録リンクは本人の公開中の発表だけに付き、公開停止・削除で報告本文は残る', async t => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, is_anonymous boolean, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('${OWNER}',false,now()),('${OTHER}',false,now());
      create table public.notes(id uuid primary key, user_id uuid not null references auth.users(id), title text, blocks jsonb);
      insert into notes values ('${ORIGIN}','${OTHER}','A','[]'),('${MINE}','${OWNER}','B','[]'),('${MINE_PRIVATE}','${OWNER}','C','[]'),('${OTHERS}','${OTHER}','D','[]');
      alter table notes enable row level security;grant select,insert,update,delete on notes to authenticated;
      create policy notes_owner on notes to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));`)
    for (const file of ['20260907034224_nitoron_publications_and_feedback.sql', '20260910150000_nitoron_feedback_related.sql'])
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
    const as = async (who, sql, params = []) => {
      await db.exec(`set role ${who ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub','${who || ''}',false);`)
      try { return await db.query(sql, params) } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);") }
    }
    const pub = async (who, id, isPublic) => { const r = newRecord(); r.id = id; r.title = `発表${id.slice(0, 1)}`; Object.assign(r.meta, { author: '人', crop: '作物', summary: '要約' }); await as(who, 'insert into nitoron_publications(id,owner_id,snapshot,is_public) values($1,$2,$3,$4)', [id, who, snapshot(r), isPublic]) }
    await pub(OTHER, ORIGIN, true); await pub(OWNER, MINE, true); await pub(OWNER, MINE_PRIVATE, false); await pub(OTHER, OTHERS, true)
    const insert = 'insert into nitoron_feedback(publication_id,user_id,author,kind,section,body,related_publication_id) values($1,$2,$3,$4,$5,$6,$7) returning id'
    let reportId
    await t.test('本人の公開中の発表だけをリンクできる。未公開・他人・存在しない発表は拒否', async () => {
      reportId = (await as(OWNER, insert, [ORIGIN, OWNER, '実践者', '試した結果', '結果', '畝を高くして冠水が減った', MINE])).rows[0].id
      await new Promise(r => setTimeout(r, 11000))
      await assert.rejects(as(OWNER, insert, [ORIGIN, OWNER, '実践者', '試した結果', '結果', '未公開の記録を付ける', MINE_PRIVATE]))
      await assert.rejects(as(OWNER, insert, [ORIGIN, OWNER, '実践者', '試した結果', '結果', '他人の記録を付ける', OTHERS]))
      await assert.rejects(as(OWNER, insert, [ORIGIN, OWNER, '実践者', '試した結果', '結果', '存在しない記録', '99999999-9999-4999-8999-999999999999']))
      assert.equal((await as(null, 'select count(*)::int as n from nitoron_feedback')).rows[0].n, 1)
    })
    await t.test('リンクなしの報告は従来どおり投稿でき、既存投稿の列は NULL', async () => {
      await new Promise(r => setTimeout(r, 11000))
      await as(OWNER, 'insert into nitoron_feedback(publication_id,user_id,author,kind,section,body) values($1,$2,$3,$4,$5,$6)', [ORIGIN, OWNER, '実践者', '試した結果', '結果', 'リンクなしの報告'])
      const rows = (await as(null, 'select body,related_publication_id from nitoron_feedback order by created_at')).rows
      assert.equal(rows[0].related_publication_id, MINE); assert.equal(rows[1].related_publication_id, null)
    })
    await t.test('投稿の更新はできない（更新経路なし）', async () => {
      await assert.rejects(as(OWNER, 'update nitoron_feedback set related_publication_id=$1 where id=$2', [OTHERS, reportId]))
      await assert.rejects(as(OWNER, "update nitoron_feedback set body='書き換え' where id=$1", [reportId]))
    })
    await t.test('関連する発表を公開停止しても報告は残り、公開中の一覧には出ない。削除すると関連IDが NULL になり本文は残る', async () => {
      await as(OWNER, 'update nitoron_publications set is_public=false where id=$1', [MINE])
      const visible = (await as(null, 'select id from nitoron_publications where id=$1 and is_public', [MINE])).rows
      assert.equal(visible.length, 0)
      assert.equal((await as(null, 'select related_publication_id from nitoron_feedback where id=$1', [reportId])).rows[0].related_publication_id, MINE, '列は変わらず、表示側が公開中のものだけ見せる')
      await db.query('delete from nitoron_publications where id=$1', [MINE])
      const after = (await as(null, 'select body,related_publication_id from nitoron_feedback where id=$1', [reportId])).rows[0]
      assert.equal(after.related_publication_id, null); assert.equal(after.body, '畝を高くして冠水が減った')
    })
  } finally { await db.close() }
})
