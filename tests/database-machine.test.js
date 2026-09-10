import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { newRecord, snapshot, fromRow } from '../src/domain.js'
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
    const r = newRecord('trouble', '発表者')
    r.id = DOC; r.title = 'キャブレターの詰まり'
    r.meta.subject = 'machine_repair'
    r.meta.machineRef = { machineId: 'skp-101w', partId: 'engine-carburetor', modelVersion: 'v4' }
    await t.test('snapshot制約（形・サイズ）に抵触せず公開できる', async () => {
      await as(OWNER, 'insert into nitoron_publications(id,owner_id,snapshot,is_public) values($1,$2,$3,true)', [DOC, OWNER, snapshot(r)])
    })
    await t.test('訪問者が読んだ公開版から同じ対象部品へ戻れる', async () => {
      const row = (await as(null, 'select snapshot from nitoron_publications')).rows[0]
      const restored = fromRow(row.snapshot)
      assert.equal(restored.meta.subject, 'machine_repair')
      assert.deepEqual(restored.meta.machineRef, { machineId: 'skp-101w', partId: 'engine-carburetor', modelVersion: 'v4' })
    })
    await t.test('機種名は生成列search_textに入り検索できる', async () => {
      const rows = (await as(null, "select id from nitoron_publications where search_text like '%skp-101w%'")).rows
      assert.equal(rows.length, 1)
    })
  } finally { await db.close() }
})
