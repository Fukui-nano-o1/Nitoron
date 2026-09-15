import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const migration = await readFile(new URL('../supabase/migrations/20260915160932_nitoron_private_access.sql', import.meta.url), 'utf8')
const OWNER = '9e4163dc-56d3-4eba-9187-6534ecc8d607'
const OTHER = '11111111-2222-4333-8444-555555555555'
async function fixture() {
  const db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role authenticator;
    create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, is_anonymous boolean,
      email_confirmed_at timestamptz, deleted_at timestamptz, banned_until timestamptz);
    insert into auth.users values
      ('${OWNER}','t5fki6643qty@gmail.com',false,now(),null,null),
      ('${OTHER}','other@example.test',false,now(),null,null);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth, public, storage to anon,authenticated,service_role;
    create table public.notes(id int primary key, user_id uuid, body text);
    create table public.nitoron_publications(id int primary key, owner_id uuid, is_public boolean);
    create table public.nitoron_profiles(id int primary key, user_id uuid);
    create table storage.objects(id int primary key, owner_id uuid, is_public boolean);
    insert into public.notes values (1,'${OWNER}','keep owner'),(2,'${OTHER}','keep other');
    insert into public.nitoron_publications values
      (1,'${OWNER}',true),(2,'${OWNER}',false),(3,'${OTHER}',true),(4,'${OTHER}',false);
    insert into public.nitoron_profiles values (1,'${OWNER}'),(2,'${OTHER}');
    insert into storage.objects values (1,'${OWNER}',true),(2,'${OTHER}',true),(3,'${OTHER}',false);
    grant select,insert,update,delete on all tables in schema public,storage to anon,authenticated,service_role;
    alter table public.notes enable row level security;
    alter table public.nitoron_publications enable row level security;
    alter table public.nitoron_profiles enable row level security;
    alter table storage.objects enable row level security;
    create policy notes_own on public.notes to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    create policy publications_read on public.nitoron_publications for select to anon,authenticated using(is_public or owner_id=auth.uid());
    create policy profiles_read on public.nitoron_profiles for select to anon,authenticated using(true);
    create policy objects_read on storage.objects for select to anon,authenticated using(is_public or owner_id=auth.uid());
    create policy objects_write on storage.objects for insert to authenticated with check(owner_id=auth.uid());
    create function public.definer_fixture() returns bigint language sql security definer set search_path='' as
      $$select count(*) from public.nitoron_publications$$;
    grant execute on function public.definer_fixture() to anon,authenticated,service_role;
  `)
  return db
}
async function asRole(db, role, uid, query) {
  await db.exec('begin')
  try {
    await db.exec(`set local role ${role}`)
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid || ''])
    return await db.query(query)
  } finally { await db.exec('rollback') }
}
const count = async (db, role, uid, table) => (await asRole(db,role,uid,`select count(*)::int as n from ${table}`)).rows[0].n

test('本人限定DB: 公開・他人・本人の境界、添付、RPC、元の所有権を維持する', async t => {
  const db = await fixture()
  try {
    assert.equal(await count(db,'anon',null,'public.nitoron_publications'),2)
    await db.exec(migration)
    await t.test('既存の公開フラグと全レコードは変えない',async()=>{
      assert.equal((await db.query('select count(*)::int n from public.nitoron_publications')).rows[0].n,4)
      assert.equal((await db.query('select count(*)::int n from public.nitoron_publications where is_public')).rows[0].n,2)
      assert.deepEqual((await db.query('select body from public.notes order by id')).rows.map(x=>x.body),['keep owner','keep other'])
    })
    await t.test('匿名と既存の別ユーザーは全対象表から0件',async()=>{
      for (const [role,id] of [['anon',null],['authenticated',OTHER]])
        for (const table of ['public.notes','public.nitoron_publications','public.nitoron_profiles','storage.objects'])
          assert.equal(await count(db,role,id,table),0)
    })
    await t.test('本人は元の一覧を読み、他人の下書きは引き続き読めない',async()=>{
      assert.equal(await count(db,'authenticated',OWNER,'public.nitoron_publications'),3)
      assert.equal(await count(db,'authenticated',OWNER,'public.notes'),1)
      assert.equal(await count(db,'authenticated',OWNER,'storage.objects'),2)
    })
    await t.test('本人の保存は通り、所有者偽装と別ユーザーの保存は拒否',async()=>{
      await asRole(db,'authenticated',OWNER,`insert into public.notes values(9,'${OWNER}','draft')`)
      await assert.rejects(asRole(db,'authenticated',OWNER,`insert into public.notes values(9,'${OTHER}','spoof')`))
      await assert.rejects(asRole(db,'authenticated',OTHER,`insert into public.notes values(9,'${OTHER}','blocked')`))
      await assert.rejects(asRole(db,'authenticated',OTHER,`insert into storage.objects values(9,'${OTHER}',true)`))
    })
    await t.test('definer RPCの呼出前でも匿名・別人を拒否、本人・管理処理は通す',async()=>{
      for (const [role,id] of [['anon',null],['authenticated',OTHER]])
        await assert.rejects(asRole(db,role,id,'select nitoron_private.require_private_access()'),/Login required/)
      await asRole(db,'authenticated',OWNER,'select nitoron_private.require_private_access()')
      await asRole(db,'service_role',null,'select nitoron_private.require_private_access()')
      assert.equal((await asRole(db,'authenticated',OWNER,'select public.definer_fixture() n')).rows[0].n,4)
      assert.equal((await db.query("select prosecdef from pg_proc where proname='require_private_access'")).rows[0].prosecdef,false)
    })
    await t.test('JWTの本人IDだけではメール変更・未確認・停止・削除を許可しない',async()=>{
      for (const change of ["email='other@example.test'","email_confirmed_at=null","is_anonymous=true","deleted_at=now()","banned_until=now()+interval '1 day'"]) {
        await db.exec(`update auth.users set ${change} where id='${OWNER}'`)
        assert.equal(await count(db,'authenticated',OWNER,'public.nitoron_publications'),0)
        await db.exec(`update auth.users set email='t5fki6643qty@gmail.com',email_confirmed_at=now(),is_anonymous=false,deleted_at=null,banned_until=null where id='${OWNER}'`)
      }
    })
    await t.test('pre-request設定が入り、既存permissiveは保持される',async()=>{
      const settings=await db.query("select unnest(setconfig) as value from pg_db_role_setting where setrole='authenticator'::regrole")
      assert(settings.rows.some(x=>x.value==='pgrst.db_pre_request=nitoron_private.require_private_access'))
      assert.equal((await db.query("select count(*)::int n from pg_policies where policyname='nitoron_private_access_only' and permissive='RESTRICTIVE'")).rows[0].n,4)
      assert.equal((await db.query("select count(*)::int n from pg_policies where policyname='publications_read' and permissive='PERMISSIVE'")).rows[0].n,1)
    })
  } finally { await db.close() }
})

test('既存の別pre-requestを無断で上書きしない',async()=>{
  const db=await fixture()
  try {
    await db.exec("alter role authenticator set pgrst.db_pre_request='public.existing_guard'")
    await assert.rejects(db.exec(migration),/Existing PostgREST pre-request/)
    const rows=(await db.query("select unnest(setconfig) as value from pg_db_role_setting where setrole='authenticator'::regrole")).rows
    assert(rows.some(x=>x.value==='pgrst.db_pre_request=public.existing_guard'))
  } finally { await db.close() }
})
