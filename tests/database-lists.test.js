import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { newRecord, snapshot } from '../src/domain.js'
const OWNER = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222'
const DOC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', DOC2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', PRIVATE_DOC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
test('保存リスト・所属・共有のSQL整合性と権限', async t => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, is_anonymous boolean, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('${OWNER}',false,now()),('${OTHER}',false,now());
      create table public.notes(id uuid primary key, user_id uuid not null references auth.users(id), title text, blocks jsonb);
      insert into notes values ('${DOC}','${OTHER}','A','[]'),('${DOC2}','${OTHER}','B','[]'),('${PRIVATE_DOC}','${OTHER}','C','[]');
      alter table notes enable row level security;grant select,insert,update,delete on notes to authenticated;
      create policy notes_owner on notes to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, unique(bucket_id,name));
      create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
      grant usage on schema storage to anon,authenticated;grant select on storage.objects to anon;grant select,insert,delete on storage.objects to authenticated;
      alter table storage.objects enable row level security;`)
    for (const file of ['20260907034224_nitoron_publications_and_feedback.sql', '20260908110127_nitoron_files_saved_and_dialogue.sql', '20260908153322_nitoron_follows_and_card_memos.sql', '20260910120000_nitoron_saved_lists.sql'])
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
    const as = async (who, sql, params = []) => {
      await db.exec(`set role ${who ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub','${who || ''}',false);`)
      try { return await db.query(sql, params) } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);") }
    }
    const count = async (who, sql, params) => (await as(who, sql, params)).rows[0].n
    // OTHER が公開発表2件・非公開1件を持つ
    for (const [id, pub] of [[DOC, true], [DOC2, true], [PRIVATE_DOC, false]]) {
      const r = newRecord(); r.id = id; r.title = `発表${id.slice(0, 1)}`; Object.assign(r.meta, { author: '発表者', crop: 'ブロッコリー', summary: '要約' })
      await as(OTHER, 'insert into nitoron_publications(id,owner_id,snapshot,is_public) values($1,$2,$3,$4)', [id, OTHER, snapshot(r), pub])
    }
    // OWNER の既存bookmark（引き継ぎ対象）
    await as(OWNER, 'insert into nitoron_bookmarks(user_id,publication_id) values($1,$2)', [OWNER, DOC])
    let list
    await t.test('新規リストは非公開でしか作れない', async () => {
      await assert.rejects(as(OWNER, 'insert into nitoron_lists(owner_id,name,is_shared,share_token) values($1,$2,true,gen_random_uuid()) returning id', [OWNER, '共有で作る']))
      await assert.rejects(as(OWNER, 'insert into nitoron_lists(owner_id,name) values($1,$2) returning id', [OTHER, '他人名義']))
      list = (await as(OWNER, 'insert into nitoron_lists(owner_id,name) values($1,$2) returning id,is_shared,share_token', [OWNER, '育苗の参考'])).rows[0]
      assert.equal(list.is_shared, false); assert.equal(list.share_token, null)
    })
    await t.test('リストへの追加は bookmark と所属を同時に作り、重複追加は増えない', async () => {
      await as(OWNER, 'select nitoron_add_to_list($1,$2)', [list.id, DOC2])
      assert.equal(await count(OWNER, 'select count(*)::int as n from nitoron_bookmarks where publication_id=$1', [DOC2]), 1)
      assert.equal(await count(OWNER, 'select count(*)::int as n from nitoron_list_items where list_id=$1', [list.id]), 1)
      await as(OWNER, 'select nitoron_add_to_list($1,$2)', [list.id, DOC2])
      assert.equal(await count(OWNER, 'select count(*)::int as n from nitoron_list_items where list_id=$1', [list.id]), 1)
      await assert.rejects(as(OWNER, 'insert into nitoron_list_items(list_id,user_id,publication_id) values($1,$2,$3)', [list.id, OWNER, DOC2]))
      // 既存bookmark（DOC）もそのままリストへ入れられる
      await as(OWNER, 'select nitoron_add_to_list($1,$2)', [list.id, DOC])
      assert.equal(await count(OWNER, 'select count(*)::int as n from nitoron_list_items where list_id=$1', [list.id]), 2)
    })
    await t.test('非公開の発表はリストへ入れられず、途中失敗で bookmark だけが残らない', async () => {
      await assert.rejects(as(OWNER, 'select nitoron_add_to_list($1,$2)', [list.id, PRIVATE_DOC]))
      assert.equal(await count(OWNER, 'select count(*)::int as n from nitoron_bookmarks where publication_id=$1', [PRIVATE_DOC]), 0)
      // bookmark なしに所属だけを作ることもできない
      await as(OWNER, 'delete from nitoron_bookmarks where publication_id=$1', [DOC])
      await assert.rejects(as(OWNER, 'insert into nitoron_list_items(list_id,user_id,publication_id) values($1,$2,$3)', [list.id, OWNER, DOC]))
      await as(OWNER, 'select nitoron_add_to_list($1,$2)', [list.id, DOC])
    })
    await t.test('他人のリストは読めず、追加・変更・削除もできない', async () => {
      assert.equal(await count(OTHER, 'select count(*)::int as n from nitoron_lists'), 0)
      assert.equal(await count(OTHER, 'select count(*)::int as n from nitoron_list_items'), 0)
      await assert.rejects(as(OTHER, 'select nitoron_add_to_list($1,$2)', [list.id, DOC2]))
      assert.equal(await count(OTHER, 'select count(*)::int as n from nitoron_bookmarks'), 0, '失敗した追加で他人の bookmark も作られない')
      assert.equal((await as(OTHER, "update nitoron_lists set name='乗っ取り' where id=$1 returning id", [list.id])).rows.length, 0)
      assert.equal((await as(OTHER, 'delete from nitoron_lists where id=$1 returning id', [list.id])).rows.length, 0)
      await assert.rejects(as(OTHER, 'select nitoron_set_list_sharing($1,true)', [list.id]))
      await assert.rejects(as(null, 'select nitoron_set_list_sharing($1,true)', [list.id]))
      await assert.rejects(as(OTHER, 'insert into nitoron_list_items(list_id,user_id,publication_id) values($1,$2,$3)', [list.id, OTHER, DOC2]))
    })
    await t.test('共有ON/OFFは関数だけが行い、直接更新はできない', async () => {
      await assert.rejects(as(OWNER, 'update nitoron_lists set is_shared=true where id=$1', [list.id]))
      await assert.rejects(as(OWNER, 'update nitoron_lists set share_token=gen_random_uuid() where id=$1', [list.id]))
      await as(OWNER, "update nitoron_lists set name='育苗の参考（改）' where id=$1", [list.id])
      assert.equal((await as(OWNER, 'select name,is_shared from nitoron_lists where id=$1', [list.id])).rows[0].is_shared, false)
    })
    let token
    await t.test('共有結果は公開中の発表だけを返し、メモは含まれない。空リストと無効リンクを区別する', async () => {
      assert.equal((await as(null, 'select nitoron_shared_list($1) as r', ['00000000-0000-4000-8000-000000000000'])).rows[0].r, null)
      const shared = (await as(OWNER, 'select * from nitoron_set_list_sharing($1,true)', [list.id])).rows[0]
      token = shared.share_token; assert.equal(shared.is_shared, true); assert.ok(token)
      await as(OWNER, "insert into nitoron_card_memos(user_id,publication_id,body) values($1,$2,'秘密のメモ')", [OWNER, DOC])
      const r = (await as(null, 'select nitoron_shared_list($1) as r', [token])).rows[0].r
      assert.equal(r.name, '育苗の参考（改）'); assert.equal(r.items.length, 2)
      assert.deepEqual(Object.keys(r.items[0]).sort(), ['id', 'is_public', 'owner_id', 'published_at', 'snapshot', 'updated_at'])
      assert.equal(JSON.stringify(r).includes('秘密のメモ'), false)
      // 公開停止した発表は本文にも件数にも含まれない
      await as(OTHER, 'update nitoron_publications set is_public=false where id=$1', [DOC2])
      const after = (await as(null, 'select nitoron_shared_list($1) as r', [token])).rows[0].r
      assert.equal(after.items.length, 1); assert.equal(after.items[0].id, DOC)
      assert.equal(JSON.stringify(after).includes(DOC2), false)
      await as(OTHER, 'update nitoron_publications set is_public=true where id=$1', [DOC2])
      // 共有中の空リストは items が空配列（null ではない）
      const empty = (await as(OWNER, "insert into nitoron_lists(owner_id,name) values($1,'空') returning id", [OWNER])).rows[0]
      const emptyToken = (await as(OWNER, 'select share_token as t from nitoron_set_list_sharing($1,true)', [empty.id])).rows[0].t
      assert.deepEqual((await as(null, 'select nitoron_shared_list($1) as r', [emptyToken])).rows[0].r.items, [])
    })
    await t.test('共有停止で旧リンクは無効になり、再共有しても復活しない', async () => {
      await as(OWNER, 'select nitoron_set_list_sharing($1,false)', [list.id])
      assert.equal((await as(null, 'select nitoron_shared_list($1) as r', [token])).rows[0].r, null)
      const again = (await as(OWNER, 'select share_token as t from nitoron_set_list_sharing($1,true)', [list.id])).rows[0].t
      assert.notEqual(again, token)
      assert.equal((await as(null, 'select nitoron_shared_list($1) as r', [token])).rows[0].r, null)
      assert.equal((await as(null, 'select nitoron_shared_list($1) as r', [again])).rows[0].r.items.length, 2)
    })
    await t.test('「すべての保存」から外すと本人の全リストから外れる', async () => {
      const second = (await as(OWNER, "insert into nitoron_lists(owner_id,name) values($1,'二つ目') returning id", [OWNER])).rows[0]
      await as(OWNER, 'select nitoron_add_to_list($1,$2)', [second.id, DOC])
      assert.equal(await count(OWNER, 'select count(*)::int as n from nitoron_list_items where publication_id=$1', [DOC]), 2)
      await as(OWNER, 'delete from nitoron_bookmarks where user_id=$1 and publication_id=$2', [OWNER, DOC])
      assert.equal(await count(OWNER, 'select count(*)::int as n from nitoron_list_items where publication_id=$1', [DOC]), 0)
      assert.equal(await count(null, 'select count(*)::int as n from nitoron_publications where id=$1', [DOC]), 1, '発表は残る')
    })
    await t.test('リストから外しても bookmark は残り、リストを削除しても発表と bookmark は残る', async () => {
      await as(OWNER, 'delete from nitoron_list_items where list_id=$1 and publication_id=$2', [list.id, DOC2])
      assert.equal(await count(OWNER, 'select count(*)::int as n from nitoron_bookmarks where publication_id=$1', [DOC2]), 1)
      await as(OWNER, 'select nitoron_add_to_list($1,$2)', [list.id, DOC2])
      await as(OWNER, 'delete from nitoron_lists where id=$1', [list.id])
      assert.equal(await count(OWNER, 'select count(*)::int as n from nitoron_list_items where list_id=$1', [list.id]), 0)
      assert.equal(await count(OWNER, 'select count(*)::int as n from nitoron_bookmarks'), 1)
      assert.equal(await count(null, 'select count(*)::int as n from nitoron_publications'), 2)
      await assert.rejects(as(null, 'select * from nitoron_lists'))
    })
  } finally { await db.close() }
})
