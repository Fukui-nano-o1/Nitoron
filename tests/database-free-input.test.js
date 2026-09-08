import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { newRecord, snapshot } from '../src/domain.js'
const OWNER = '11111111-1111-4111-8111-111111111111'
const DOC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

test('フリー入力の発表はタイトルだけで公開できる', async t => {
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
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/20260907034224_nitoron_publications_and_feedback.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/migrations/20260908114500_nitoron_free_input_publication.sql', import.meta.url), 'utf8'))
    const as = async (user, sql, params = []) => {
      await db.exec(`set role ${user ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${user || ''}', false);`)
      try { return await db.query(sql, params) } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);") }
    }
    await t.test('発表者名・作物・要約が空でも公開できる', async () => {
      const r = newRecord(); r.id = DOC; r.title = '自由に書いた発表'
      assert.equal(r.meta.author, ''); assert.equal(r.meta.summary, '')
      await as(OWNER, 'insert into nitoron_publications(id,owner_id,snapshot,is_public) values($1,$2,$3,true)', [DOC, OWNER, snapshot(r)])
      assert.equal((await as(null, 'select * from nitoron_publications')).rows.length, 1)
    })
    await t.test('タイトルなしと上限超過は今までどおり拒否する', async () => {
      const empty = newRecord(); empty.id = DOC
      await assert.rejects(as(OWNER, 'update nitoron_publications set snapshot=$1 where id=$2', [snapshot(empty), DOC]))
      const long = newRecord(); long.id = DOC; long.title = '発表'; long.meta.summary = 'あ'.repeat(2001)
      await assert.rejects(as(OWNER, 'update nitoron_publications set snapshot=$1 where id=$2', [snapshot(long), DOC]))
    })
  } finally { await db.close() }
})
