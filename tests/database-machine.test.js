import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { newRecord, publicSnapshot, fromRow } from '../src/domain.js'
import { MACHINE_SUBJECT, MODEL_VERSION, resolveMachineRef } from '../src/machine-domain.js'
const OWNER = '11111111-1111-4111-8111-111111111111'
const DOC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

test('機械参照つきの発表は既存のDB制約のまま公開・再読込できる', async t => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, is_anonymous boolean, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('${OWNER}',false,now());
      create table public.notes(id uuid primary key, user_id uuid not null references auth.users(id), title text, blocks jsonb);
      insert into notes values ('${DOC}','${OWNER}','DRAFT','[]');
      alter table notes enable row level security;
      grant select,insert,update,delete on notes to authenticated;
      create policy notes_owner on notes to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
      -- 110127はストレージのRLSも設定するため、Supabaseのstorageスキーマ相当を用意する（stage2テストと同じ）。
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, unique(bucket_id,name));
      create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
      grant usage on schema storage to anon,authenticated;
      alter table storage.objects enable row level security;
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/20260907034224_nitoron_publications_and_feedback.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/migrations/20260908110127_nitoron_files_saved_and_dialogue.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/migrations/20260908114500_nitoron_free_input_publication.sql', import.meta.url), 'utf8'))
    const as = async (user, sql, params = []) => {
      await db.exec(`set role ${user ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${user || ''}', false);`)
      try { return await db.query(sql, params) } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);") }
    }
    const repair = partId => {
      const r = newRecord('trouble', '発表者')
      r.id = DOC; r.title = 'キャブレターの詰まり'
      r.meta.subject = MACHINE_SUBJECT
      r.meta.machineRef = { machineId: 'skp-101w', partId, modelVersion: MODEL_VERSION }
      return r
    }
    await t.test('全体・外装・内部・深い階層の実IDがsnapshot制約を通り、匿名読出から提供resolverまで一致する', async () => {
      const cases = [['machine', 'whole', 'SKP-101W'], ['bonnet', 'resolved', 'ボンネット'],
        ['aircleaner__element', 'resolved', 'エアクリーナエレメント'], ['frontL__fasteners__a0__bolt', 'resolved', 'ボルト（形状・本数未確認）']]
      await as(OWNER, 'insert into nitoron_publications(id,owner_id,snapshot,is_public) values($1,$2,$3,true)', [DOC, OWNER, publicSnapshot(repair('machine'))])
      for (const [partId, status, name] of cases) {
        await as(OWNER, 'update nitoron_publications set snapshot=$1 where id=$2', [publicSnapshot(repair(partId)), DOC])
        const row = (await as(null, 'select snapshot from nitoron_publications')).rows[0]
        const restored = fromRow(row.snapshot)
        assert.equal(restored.meta.subject, MACHINE_SUBJECT)
        assert.deepEqual(restored.meta.machineRef, { machineId: 'skp-101w', partId, modelVersion: MODEL_VERSION })
        const resolution = resolveMachineRef(restored.meta.machineRef)
        assert.equal(resolution.status, status)
        assert.equal(resolution.node.name, name)
      }
    })
    await t.test('非公開の発表は匿名から読めないまま', async () => {
      await as(OWNER, 'update nitoron_publications set is_public=false where id=$1', [DOC])
      assert.equal((await as(null, 'select id from nitoron_publications')).rows.length, 0)
      assert.equal((await as(OWNER, 'select id from nitoron_publications')).rows.length, 1)
      await as(OWNER, 'update nitoron_publications set is_public=true where id=$1', [DOC])
    })
    await t.test('下書きの対象変更は公開版更新まで公開snapshotに反映されない', async () => {
      // 直前の公開版は frontL__fasteners__a0__bolt。下書きを bonnet に変えてもDBの公開版は変わらない
      const before = fromRow((await as(null, 'select snapshot from nitoron_publications')).rows[0].snapshot)
      assert.equal(before.meta.machineRef.partId, 'frontL__fasteners__a0__bolt')
      await as(OWNER, 'update nitoron_publications set snapshot=$1 where id=$2', [publicSnapshot(repair('bonnet')), DOC])
      const after = fromRow((await as(null, 'select snapshot from nitoron_publications')).rows[0].snapshot)
      assert.equal(after.meta.machineRef.partId, 'bonnet')
    })
    await t.test('保存済みIDはsearch_textに入るが、カタログの日本語名は入らない', async () => {
      // 検索語 'skp-101w' は snapshot 内の machineId に一致する。部品の日本語名（例：ボンネット）は
      // snapshot に保存されないため、日本語名では一致しない（今回の範囲では日本語名検索を追加しない）。
      const hit = (await as(null, "select substring(search_text from '[a-z0-9@_-]*skp-101w[a-z0-9@_-]*') as ctx from nitoron_publications where search_text like '%skp-101w%'")).rows
      assert.equal(hit.length, 1)
      assert.match(hit[0].ctx, /skp-101w/)
      assert.equal((await as(null, "select id from nitoron_publications where search_text like '%ボンネット%'")).rows.length, 0)
    })
  } finally { await db.close() }
})
