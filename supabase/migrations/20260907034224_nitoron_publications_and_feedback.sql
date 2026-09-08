-- Nitoron: additive publishing layer. Existing notes/settings stay private and unchanged.
-- Apply to the existing Nitoron Supabase project after checking notes(id,user_id).
create schema if not exists nitoron_private;
revoke all on schema nitoron_private from public, anon;
grant usage on schema nitoron_private to authenticated;

-- This narrowly scoped lookup needs auth.users access. It is not a public RPC.
create or replace function nitoron_private.is_verified()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = (select auth.uid()) and not coalesce(u.is_anonymous, true)
      and u.email_confirmed_at is not null
  );
$$;
revoke all on function nitoron_private.is_verified() from public, anon;
grant execute on function nitoron_private.is_verified() to authenticated;

create table public.nitoron_publications (
  id uuid primary key references public.notes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  is_public boolean not null default false,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (
    translate(lower(normalize(snapshot::text, NFKC)),
      'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ',
      'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ')
  ) stored,
  constraint nitoron_snapshot_size check (octet_length(snapshot::text) <= 1048576),
  constraint nitoron_snapshot_shape check (
    jsonb_typeof(snapshot) = 'object'
    and coalesce(snapshot->>'id' = id::text, false)
    and coalesce(jsonb_typeof(snapshot->'blocks') = 'array', false)
    and coalesce(jsonb_typeof(snapshot->'meta') = 'object', false)
    and coalesce(length(btrim(snapshot->>'title')) between 1 and 200, false)
    and coalesce(length(btrim(snapshot->'meta'->>'author')) between 1 and 160, false)
    and coalesce(length(btrim(snapshot->'meta'->>'crop')) between 1 and 160, false)
    and coalesce(length(btrim(snapshot->'meta'->>'summary')) between 1 and 2000, false)
  )
);
create index nitoron_publications_owner_idx on public.nitoron_publications(owner_id);
create index nitoron_publications_recent_idx on public.nitoron_publications(updated_at desc, id) where is_public;
alter table public.nitoron_publications enable row level security;
revoke all on public.nitoron_publications from public, anon, authenticated;
grant select on public.nitoron_publications to anon, authenticated;
grant insert, update on public.nitoron_publications to authenticated;
create policy nitoron_publications_read on public.nitoron_publications for select to anon, authenticated
  using (is_public or owner_id = (select auth.uid()));
create policy nitoron_publications_insert on public.nitoron_publications for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select nitoron_private.is_verified())
    and exists (select 1 from public.notes n where n.id = nitoron_publications.id and n.user_id = (select auth.uid())));
create policy nitoron_publications_update on public.nitoron_publications for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and (select nitoron_private.is_verified())
    and exists (select 1 from public.notes n where n.id = nitoron_publications.id and n.user_id = (select auth.uid())));

create or replace function nitoron_private.stamp_publication()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id then
      raise exception 'Publication identity cannot be changed';
    end if;
    new.published_at := old.published_at;
  else
    new.published_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function nitoron_private.stamp_publication() from public, anon, authenticated;
create trigger nitoron_publication_timestamp before insert or update on public.nitoron_publications
for each row execute function nitoron_private.stamp_publication();

create table public.nitoron_feedback (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.nitoron_publications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author text not null check (length(btrim(author)) between 1 and 80),
  kind text not null check (kind in ('質問', '指摘', '提案', '試した結果')),
  section text not null check (section in ('全体', '課題', '仮説', '実践したこと', '結果', '考察', '学びと次の一手')),
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index nitoron_feedback_publication_idx on public.nitoron_feedback(publication_id, created_at desc);
create index nitoron_feedback_user_idx on public.nitoron_feedback(user_id);
alter table public.nitoron_feedback enable row level security;
revoke all on public.nitoron_feedback from public, anon, authenticated;
grant select on public.nitoron_feedback to anon, authenticated;
grant insert, delete on public.nitoron_feedback to authenticated;
create policy nitoron_feedback_read on public.nitoron_feedback for select to anon, authenticated
  using (exists (select 1 from public.nitoron_publications p where p.id = publication_id and (p.is_public or p.owner_id = (select auth.uid()))));
create policy nitoron_feedback_insert on public.nitoron_feedback for insert to authenticated
  with check (user_id = (select auth.uid()) and (select nitoron_private.is_verified())
    and exists (select 1 from public.nitoron_publications p where p.id = publication_id and p.is_public));
create policy nitoron_feedback_delete on public.nitoron_feedback for delete to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.nitoron_publications p where p.id = publication_id and p.owner_id = (select auth.uid())));

-- Durable per-account limits, including deleted posts. No client table access.
create table nitoron_private.feedback_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  last_post timestamptz not null,
  post_count integer not null
);
alter table nitoron_private.feedback_limits enable row level security;
revoke all on nitoron_private.feedback_limits from public, anon, authenticated;
create or replace function nitoron_private.limit_feedback()
returns trigger language plpgsql security definer set search_path = '' as $$
declare rate nitoron_private.feedback_limits;
begin
  if auth.uid() is null or new.user_id <> auth.uid() or not nitoron_private.is_verified() then
    raise exception 'Verified owner required' using errcode = '42501';
  end if;
  insert into nitoron_private.feedback_limits(user_id, window_start, last_post, post_count)
    values (new.user_id, now(), now() - interval '1 minute', 0) on conflict (user_id) do nothing;
  select * into rate from nitoron_private.feedback_limits where user_id = new.user_id for update;
  if rate.last_post > now() - interval '10 seconds' then raise exception 'Rate limit'; end if;
  if rate.window_start < now() - interval '1 day' then rate.post_count := 0; rate.window_start := now(); end if;
  if rate.post_count >= 40 then raise exception 'Rate limit'; end if;
  update nitoron_private.feedback_limits set post_count = rate.post_count + 1, window_start = rate.window_start, last_post = now() where user_id = new.user_id;
  new.created_at := now();
  return new;
end;
$$;
revoke all on function nitoron_private.limit_feedback() from public, anon, authenticated;
create trigger nitoron_feedback_limit before insert on public.nitoron_feedback
for each row execute function nitoron_private.limit_feedback();

notify pgrst, 'reload schema';
