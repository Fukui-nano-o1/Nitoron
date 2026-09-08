-- カードメニュー（フォロー・自分用メモ）。20260908114500_nitoron_free_input_publication.sql の後に適用。
-- 追加のみ：既存のデータ・ポリシーは変更しない。フォローとメモは本人だけが読める非公開データ。
create table public.nitoron_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id, owner_id),
  check(follower_id <> owner_id)
);
create index nitoron_follows_owner_idx on public.nitoron_follows(owner_id);
alter table public.nitoron_follows enable row level security;
revoke all on public.nitoron_follows from public, anon, authenticated;
grant select, insert, delete on public.nitoron_follows to authenticated;
create policy nitoron_follows_read on public.nitoron_follows for select to authenticated
  using(follower_id = (select auth.uid()));
create policy nitoron_follows_insert on public.nitoron_follows for insert to authenticated
  with check(follower_id = (select auth.uid())
    and exists(select 1 from public.nitoron_publications p where p.owner_id = nitoron_follows.owner_id and p.is_public));
create policy nitoron_follows_delete on public.nitoron_follows for delete to authenticated
  using(follower_id = (select auth.uid()));

create table public.nitoron_card_memos (
  user_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid not null references public.nitoron_publications(id) on delete cascade,
  body text not null check(length(btrim(body)) between 1 and 2000),
  updated_at timestamptz not null default now(),
  primary key(user_id, publication_id)
);
create index nitoron_card_memos_publication_idx on public.nitoron_card_memos(publication_id);
alter table public.nitoron_card_memos enable row level security;
revoke all on public.nitoron_card_memos from public, anon, authenticated;
grant select, insert, update, delete on public.nitoron_card_memos to authenticated;
create policy nitoron_card_memos_read on public.nitoron_card_memos for select to authenticated
  using(user_id = (select auth.uid()));
create policy nitoron_card_memos_insert on public.nitoron_card_memos for insert to authenticated
  with check(user_id = (select auth.uid())
    and exists(select 1 from public.nitoron_publications p where p.id = publication_id and p.is_public));
create policy nitoron_card_memos_update on public.nitoron_card_memos for update to authenticated
  using(user_id = (select auth.uid())) with check(user_id = (select auth.uid()));
create policy nitoron_card_memos_delete on public.nitoron_card_memos for delete to authenticated
  using(user_id = (select auth.uid()));
create or replace function nitoron_private.stamp_card_memo()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.user_id is distinct from old.user_id or new.publication_id is distinct from old.publication_id) then
    raise exception 'Memo identity cannot be changed';
  end if;
  new.updated_at := now(); return new;
end;
$$;
revoke all on function nitoron_private.stamp_card_memo() from public, anon, authenticated;
create trigger nitoron_card_memo_timestamp before insert or update on public.nitoron_card_memos
  for each row execute function nitoron_private.stamp_card_memo();
notify pgrst, 'reload schema';
