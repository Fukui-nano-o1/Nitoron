import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const OWNER = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222'

test('アカウント項目のSQL権限：公開プロフィールは誰でも読め、連絡先は本人だけ', async t => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, is_anonymous boolean, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('${OWNER}',false,now()),('${OTHER}',false,now());
      -- 本番の settings と同じ形（本人だけの RLS）
      create table public.settings(user_id uuid primary key default auth.uid() references auth.users(id), display_name text not null default '', updated_at timestamptz not null default now());
      alter table public.settings enable row level security;
      grant select,insert,update,delete on public.settings to anon, authenticated;
      create policy "own select" on public.settings for select using ((select auth.uid()) = user_id);
      create policy "own insert" on public.settings for insert with check ((select auth.uid()) = user_id);
      create policy "own update" on public.settings for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/20260908153000_nitoron_profiles.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/migrations/20260914130000_nitoron_account_fields.sql', import.meta.url), 'utf8'))
    const as = async (user, sql, params = []) => {
      await db.exec(`set role ${user ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${user || ''}', false);`)
      try { return await db.query(sql, params) } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);") }
    }
    await t.test('公開プロフィール：立場・作物・機械は本人が書き、誰でも読める', async () => {
      await as(OWNER, 'insert into nitoron_profiles(user_id,display_name,role,crops,machines) values($1,$2,$3,$4,$5)', [OWNER, 'たきと', '農家', 'ブロッコリー', JSON.stringify([{ id: 'm1', maker: 'クボタ', model: 'SKP-101W', year: '2019', note: '' }])])
      const row = (await as(null, 'select role,crops,machines from nitoron_profiles where user_id=$1', [OWNER])).rows[0]
      assert.equal(row.role, '農家'); assert.equal(row.machines[0].model, 'SKP-101W')
      await assert.rejects(as(OTHER, 'update nitoron_profiles set role=$1 where user_id=$2 returning user_id', ['整備士', OWNER]).then(r => { if (!r.rows.length) throw new Error('no row') }))
      await assert.rejects(as(OWNER, 'update nitoron_profiles set machines=$1 where user_id=$2', ['{"a":1}', OWNER]), /check|constraint/i)
      await assert.rejects(as(OWNER, 'update nitoron_profiles set machines=$1 where user_id=$2', [JSON.stringify([...Array(31)].map(() => ({ maker: 'x' }))), OWNER]), /check|constraint/i)
      await assert.rejects(as(OWNER, 'update nitoron_profiles set role=$1 where user_id=$2', ['あ'.repeat(41), OWNER]), /check|constraint/i)
    })
    await t.test('連絡先：本人だけが書き、他人・未ログインは読めない', async () => {
      await as(OWNER, 'insert into settings(user_id,full_name,phone,address) values($1,$2,$3,$4)', [OWNER, '本名', '090-0000-0000', '福井県'])
      assert.equal((await as(OWNER, 'select phone from settings')).rows[0].phone, '090-0000-0000')
      assert.equal((await as(OTHER, 'select phone from settings')).rows.length, 0)
      assert.equal((await as(null, 'select phone from settings')).rows.length, 0)
      await assert.rejects(as(OTHER, 'insert into settings(user_id,phone) values($1,$2)', [OWNER, '000']))
      await assert.rejects(as(OWNER, 'update settings set phone=$1', ['1'.repeat(41)]), /check|constraint/i)
      // 表示名だけの upsert（既存の同期処理）が連絡先を消さない
      await as(OWNER, 'insert into settings(user_id,display_name) values($1,$2) on conflict (user_id) do update set display_name=excluded.display_name', [OWNER, '新しい名前'])
      assert.equal((await as(OWNER, 'select phone from settings')).rows[0].phone, '090-0000-0000')
    })
  } finally { await db.close() }
})
