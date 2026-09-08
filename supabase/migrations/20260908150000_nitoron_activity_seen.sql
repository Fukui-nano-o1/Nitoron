-- Stage 3. Apply AFTER 20260908110127_nitoron_files_saved_and_dialogue.sql.
-- Tracks when a user last checked a publication's feedback, so the app can
-- badge new feedback and replies on saved and own publications.
create table public.nitoron_publication_seen (
  user_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid not null references public.nitoron_publications(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key(user_id, publication_id)
);
alter table public.nitoron_publication_seen enable row level security;
revoke all on public.nitoron_publication_seen from public, anon, authenticated;
grant select, insert, update, delete on public.nitoron_publication_seen to authenticated;
create policy nitoron_seen_read on public.nitoron_publication_seen for select to authenticated
  using(user_id = (select auth.uid()));
create policy nitoron_seen_insert on public.nitoron_publication_seen for insert to authenticated
  with check(user_id = (select auth.uid())
    and exists(select 1 from public.nitoron_publications p where p.id = publication_id and (p.is_public or p.owner_id = (select auth.uid()))));
create policy nitoron_seen_update on public.nitoron_publication_seen for update to authenticated
  using(user_id = (select auth.uid()))
  with check(user_id = (select auth.uid()));
create policy nitoron_seen_delete on public.nitoron_publication_seen for delete to authenticated
  using(user_id = (select auth.uid()));
notify pgrst, 'reload schema';
