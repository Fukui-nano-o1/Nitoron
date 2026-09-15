-- Nitoron private development: preserve records and existing ownership rules.
-- This migration does not configure Supabase Auth's outbound email delivery.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_db_role_setting s
    join pg_catalog.pg_roles r on r.oid = s.setrole
    cross join lateral unnest(s.setconfig) setting
    where r.rolname = 'authenticator'
      and split_part(setting, '=', 1) = 'pgrst.db_pre_request'
      and substr(setting, length('pgrst.db_pre_request=') + 1)
        not in ('', 'nitoron_private.require_private_access')
  ) then
    raise exception 'Existing PostgREST pre-request must be preserved; private access not applied';
  end if;
end;
$$;

create schema if not exists nitoron_private;

create or replace function nitoron_private.private_access_allowed()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = (select auth.uid())
      and u.id = '9e4163dc-56d3-4eba-9187-6534ecc8d607'::uuid
      and lower(btrim(u.email)) = 't5fki6643qty@gmail.com'
      and not coalesce(u.is_anonymous, true)
      and u.email_confirmed_at is not null
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;
revoke all on function nitoron_private.private_access_allowed() from public;
grant usage on schema nitoron_private to anon, authenticated, service_role, authenticator;
grant execute on function nitoron_private.private_access_allowed()
  to anon, authenticated, service_role, authenticator;

-- AND with existing permissive policies. No new permission to read/write rows.
do $$
declare target record;
begin
  for target in
    select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and
      (n.nspname = 'public' or (n.nspname = 'storage' and c.relname = 'objects'))
  loop
    if not target.rls_enabled then
      execute format('alter table %I.%I enable row level security', target.schema_name, target.table_name);
    end if;
    execute format('drop policy if exists nitoron_private_access_only on %I.%I', target.schema_name, target.table_name);
    execute format('create policy nitoron_private_access_only on %I.%I as restrictive for all to anon, authenticated using ((select nitoron_private.private_access_allowed())) with check ((select nitoron_private.private_access_allowed()))', target.schema_name, target.table_name);
  end loop;
end;
$$;

-- PostgREST runs this after switching to the request role, before tables/RPC.
-- Keep SECURITY INVOKER: current_user must be the request role, not postgres.
create or replace function nitoron_private.require_private_access()
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if current_user = 'service_role' then return; end if;
  if not nitoron_private.private_access_allowed() then
    raise exception 'Login required' using errcode = '42501';
  end if;
end;
$$;
revoke all on function nitoron_private.require_private_access() from public;
grant execute on function nitoron_private.require_private_access()
  to anon, authenticated, service_role, authenticator;

alter role authenticator set pgrst.db_pre_request = 'nitoron_private.require_private_access';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
