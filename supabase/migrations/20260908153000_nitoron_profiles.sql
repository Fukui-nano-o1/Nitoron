-- Public presenter profiles shown on #/user/<id>; one row per account, owner-writable.
create table public.nitoron_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 80),
  region text not null default '' check (length(region) <= 80),
  club text not null default '' check (length(club) <= 120),
  bio text not null default '' check (length(bio) <= 600),
  updated_at timestamptz not null default now()
);
alter table public.nitoron_profiles enable row level security;
grant select on public.nitoron_profiles to anon, authenticated;
grant insert, update on public.nitoron_profiles to authenticated;
create policy nitoron_profiles_read on public.nitoron_profiles for select to anon, authenticated
  using (true);
create policy nitoron_profiles_insert on public.nitoron_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy nitoron_profiles_update on public.nitoron_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
