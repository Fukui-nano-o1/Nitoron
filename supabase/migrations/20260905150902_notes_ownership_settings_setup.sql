-- このマイグレーションは Supabase 側で直接適用されたものを、観測したスキーマから復元して記録したもの。
-- ユーザーごとの設定(表示名)を保持する settings テーブル。

-- insert 時に user_id が未指定なら auth.uid() を補う
create or replace function public.claim_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end
$$;

create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

create trigger settings_claim_owner
  before insert on public.settings
  for each row execute function public.claim_owner();

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

create policy "own select" on public.settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own insert" on public.settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own update" on public.settings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own delete" on public.settings for delete to authenticated
  using ((select auth.uid()) = user_id);
