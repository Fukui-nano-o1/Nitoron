-- Stage 2. Apply AFTER 20260907034224_nitoron_publications_and_feedback.sql.
-- Additive: no existing notes or settings data is modified.
-- Private bucket; never grant public access to all objects.
create or replace function nitoron_private.search_normalize(value text)
returns text language sql immutable security invoker set search_path = '' as $$
  select translate(lower(normalize(coalesce(value, ''), NFKC)),
    'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ',
    'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ');
$$;
revoke all on function nitoron_private.search_normalize(text) from public, anon;
grant execute on function nitoron_private.search_normalize(text) to authenticated;
create or replace function nitoron_private.metric_recorded(value text)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare n double precision;
begin
  if value is null or btrim(value) = '' then return false; end if;
  n := value::double precision;
  return n >= 0 and n <> 'Infinity'::double precision and n <> 'NaN'::double precision;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end;
$$;
revoke all on function nitoron_private.metric_recorded(text) from public, anon;
grant execute on function nitoron_private.metric_recorded(text) to authenticated;
alter table public.nitoron_publications
  add column region_search text generated always as (nitoron_private.search_normalize(snapshot->'meta'->>'region')) stored,
  add column crop_search text generated always as (nitoron_private.search_normalize(snapshot->'meta'->>'crop')) stored,
  add column title_search text generated always as (nitoron_private.search_normalize(snapshot->>'title')) stored,
  add column has_metrics boolean generated always as (
    nitoron_private.metric_recorded(snapshot->'meta'->>'revenue') or
    nitoron_private.metric_recorded(snapshot->'meta'->>'cost') or
    nitoron_private.metric_recorded(snapshot->'meta'->>'hours') or
    nitoron_private.metric_recorded(snapshot->'meta'->>'yieldKg')
  ) stored;
create index nitoron_publications_title_idx on public.nitoron_publications(title_search, id) where is_public;

create table public.nitoron_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid not null references public.nitoron_publications(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, publication_id)
);
create index nitoron_bookmarks_publication_idx on public.nitoron_bookmarks(publication_id);
alter table public.nitoron_bookmarks enable row level security;
revoke all on public.nitoron_bookmarks from public, anon, authenticated;
grant select, insert, delete on public.nitoron_bookmarks to authenticated;
create policy nitoron_bookmarks_read on public.nitoron_bookmarks for select to authenticated
  using(user_id = (select auth.uid()));
create policy nitoron_bookmarks_insert on public.nitoron_bookmarks for insert to authenticated
  with check(user_id = (select auth.uid()) and exists(select 1 from public.nitoron_publications p where p.id = publication_id and p.is_public));
create policy nitoron_bookmarks_delete on public.nitoron_bookmarks for delete to authenticated
  using(user_id = (select auth.uid()));

alter table public.nitoron_feedback add constraint nitoron_feedback_id_publication_unique unique(id, publication_id);
create table public.nitoron_feedback_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null,
  publication_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  author text not null check(length(btrim(author)) between 1 and 80),
  body text not null check(length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  foreign key(feedback_id, publication_id) references public.nitoron_feedback(id, publication_id) on delete cascade
);
create index nitoron_replies_feedback_idx on public.nitoron_feedback_replies(feedback_id, publication_id);
create index nitoron_replies_publication_idx on public.nitoron_feedback_replies(publication_id, created_at, id);
create index nitoron_replies_user_idx on public.nitoron_feedback_replies(user_id);
alter table public.nitoron_feedback_replies enable row level security;
revoke all on public.nitoron_feedback_replies from public, anon, authenticated;
grant select on public.nitoron_feedback_replies to anon, authenticated;
grant insert, delete on public.nitoron_feedback_replies to authenticated;
create policy nitoron_replies_read on public.nitoron_feedback_replies for select to anon, authenticated
  using(exists(select 1 from public.nitoron_publications p where p.id = publication_id and (p.is_public or p.owner_id = (select auth.uid()))));
create policy nitoron_replies_insert on public.nitoron_feedback_replies for insert to authenticated
  with check(user_id = (select auth.uid()) and (select nitoron_private.is_verified())
    and exists(select 1 from public.nitoron_publications p where p.id = publication_id and p.is_public));
create policy nitoron_replies_delete on public.nitoron_feedback_replies for delete to authenticated
  using(user_id = (select auth.uid()) or exists(select 1 from public.nitoron_publications p where p.id = publication_id and p.owner_id = (select auth.uid())));
create trigger nitoron_reply_limit before insert on public.nitoron_feedback_replies
  for each row execute function nitoron_private.limit_feedback();

create table public.nitoron_feedback_resolutions (
  feedback_id uuid primary key,
  publication_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check(status in ('未対応','検討中','対応済み')),
  updated_at timestamptz not null default now(),
  foreign key(feedback_id, publication_id) references public.nitoron_feedback(id, publication_id) on delete cascade
);
create index nitoron_resolution_publication_idx on public.nitoron_feedback_resolutions(publication_id);
create index nitoron_resolution_user_idx on public.nitoron_feedback_resolutions(user_id);
alter table public.nitoron_feedback_resolutions enable row level security;
revoke all on public.nitoron_feedback_resolutions from public, anon, authenticated;
grant select on public.nitoron_feedback_resolutions to anon, authenticated;
grant insert, update on public.nitoron_feedback_resolutions to authenticated;
create policy nitoron_resolutions_read on public.nitoron_feedback_resolutions for select to anon, authenticated
  using(exists(select 1 from public.nitoron_publications p where p.id = publication_id and (p.is_public or p.owner_id = (select auth.uid()))));
create policy nitoron_resolutions_insert on public.nitoron_feedback_resolutions for insert to authenticated
  with check(user_id = (select auth.uid()) and (select nitoron_private.is_verified())
    and exists(select 1 from public.nitoron_publications p where p.id = publication_id and p.owner_id = (select auth.uid())));
create policy nitoron_resolutions_update on public.nitoron_feedback_resolutions for update to authenticated
  using(user_id = (select auth.uid()) and exists(select 1 from public.nitoron_publications p where p.id = publication_id and p.owner_id = (select auth.uid())))
  with check(user_id = (select auth.uid()) and (select nitoron_private.is_verified())
    and exists(select 1 from public.nitoron_publications p where p.id = publication_id and p.owner_id = (select auth.uid())));
create or replace function nitoron_private.stamp_resolution()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.feedback_id is distinct from old.feedback_id or new.publication_id is distinct from old.publication_id or new.user_id is distinct from old.user_id) then
    raise exception 'Resolution identity cannot be changed';
  end if;
  new.updated_at := now(); return new;
end;
$$;
revoke all on function nitoron_private.stamp_resolution() from public, anon, authenticated;
create trigger nitoron_resolution_timestamp before insert or update on public.nitoron_feedback_resolutions
  for each row execute function nitoron_private.stamp_resolution();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('nitoron-files','nitoron-files',false,20971520,array['image/jpeg','image/png','image/webp','image/avif','application/pdf']);
create policy nitoron_files_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'nitoron-files' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists(select 1 from public.nitoron_publications p
      where p.is_public and p.owner_id::text = (storage.foldername(name))[1]
        and coalesce(p.snapshot->'meta'->'attachments', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('path', name)))
  ));
create policy nitoron_files_insert on storage.objects for insert to authenticated
  with check(bucket_id = 'nitoron-files' and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|avif|pdf)$'
    and exists(select 1 from public.notes n where n.id::text = (storage.foldername(name))[2] and n.user_id = (select auth.uid())));
create policy nitoron_files_delete on storage.objects for delete to authenticated
  using(bucket_id = 'nitoron-files' and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists(select 1 from public.nitoron_publications p where p.is_public and p.owner_id = (select auth.uid())
      and coalesce(p.snapshot->'meta'->'attachments', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('path', name))));
-- No UPDATE policy: published assets are immutable; replacements get a new path.
create or replace function nitoron_private.validate_publication_files()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare files jsonb; asset jsonb;
begin
  files := coalesce(new.snapshot->'meta'->'attachments', '[]'::jsonb);
  if jsonb_typeof(files) <> 'array' then raise exception 'Attachments must be an array'; end if;
  if jsonb_array_length(files) > 12 then raise exception 'Too many attachments'; end if;
  for asset in select * from jsonb_array_elements(files) loop
    if not coalesce((asset->>'path') ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|avif|pdf)$', false)
      or split_part(asset->>'path', '/', 1) <> new.owner_id::text
      or not exists(select 1 from storage.objects o where o.bucket_id = 'nitoron-files' and o.name = asset->>'path') then
      raise exception 'Only existing, owned files can be published' using errcode='42501';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function nitoron_private.validate_publication_files() from public, anon, authenticated;
create trigger nitoron_publication_files before insert or update of snapshot on public.nitoron_publications
  for each row execute function nitoron_private.validate_publication_files();
notify pgrst, 'reload schema';
