-- Nitoron: 名前付き保存リストと共有。既存の nitoron_bookmarks は「すべての保存」としてそのまま使う。
-- 整合性はDBで保証する：
--   * リスト所属（nitoron_list_items）は、本人の bookmarks 行への外部キーを持つ（bookmark を消せば全リストから外れる）
--   * 所属の user_id はリストの owner_id と一致する（複合外部キー）
--   * 同じリストへの重複追加は主キーで防ぐ
--   * 追加は関数 nitoron_add_to_list で bookmark と所属を1トランザクションで書く
--   * 共有ON/OFFとトークン更新は関数 nitoron_set_list_sharing だけが行う（列権限で直接更新を禁止）
create table public.nitoron_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  is_shared boolean not null default false,
  share_token uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nitoron_lists_share_state check ((is_shared and share_token is not null) or (not is_shared and share_token is null)),
  unique (id, owner_id)
);
create index nitoron_lists_owner_idx on public.nitoron_lists(owner_id, created_at);
alter table public.nitoron_lists enable row level security;
revoke all on public.nitoron_lists from public, anon, authenticated;
grant select, insert, delete on public.nitoron_lists to authenticated;
grant update (name) on public.nitoron_lists to authenticated;
create policy nitoron_lists_read on public.nitoron_lists for select to authenticated
  using (owner_id = (select auth.uid()));
-- 新規リストは必ず非公開で作る。
create policy nitoron_lists_insert on public.nitoron_lists for insert to authenticated
  with check (owner_id = (select auth.uid()) and not is_shared and share_token is null);
create policy nitoron_lists_update on public.nitoron_lists for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy nitoron_lists_delete on public.nitoron_lists for delete to authenticated
  using (owner_id = (select auth.uid()));
create or replace function nitoron_private.stamp_list()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.id is distinct from old.id or new.owner_id is distinct from old.owner_id) then
    raise exception 'List identity cannot be changed';
  end if;
  new.updated_at := now(); return new;
end;
$$;
revoke all on function nitoron_private.stamp_list() from public, anon, authenticated;
create trigger nitoron_list_timestamp before insert or update on public.nitoron_lists
  for each row execute function nitoron_private.stamp_list();

create table public.nitoron_list_items (
  list_id uuid not null,
  user_id uuid not null,
  publication_id uuid not null,
  added_at timestamptz not null default now(),
  primary key (list_id, publication_id),
  foreign key (list_id, user_id) references public.nitoron_lists(id, owner_id) on delete cascade,
  foreign key (user_id, publication_id) references public.nitoron_bookmarks(user_id, publication_id) on delete cascade,
  foreign key (publication_id) references public.nitoron_publications(id) on delete cascade
);
create index nitoron_list_items_user_idx on public.nitoron_list_items(user_id, publication_id);
create index nitoron_list_items_publication_idx on public.nitoron_list_items(publication_id);
alter table public.nitoron_list_items enable row level security;
revoke all on public.nitoron_list_items from public, anon, authenticated;
grant select, insert, delete on public.nitoron_list_items to authenticated;
create policy nitoron_list_items_read on public.nitoron_list_items for select to authenticated
  using (user_id = (select auth.uid()));
create policy nitoron_list_items_insert on public.nitoron_list_items for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.nitoron_lists l where l.id = list_id and l.owner_id = (select auth.uid()))
    and exists (select 1 from public.nitoron_publications p where p.id = publication_id and p.is_public));
create policy nitoron_list_items_delete on public.nitoron_list_items for delete to authenticated
  using (user_id = (select auth.uid()));

-- リストへの追加：bookmark と所属を同じトランザクションで書く（本人のリスト以外は拒否。途中で失敗すれば両方とも残らない）。
create or replace function public.nitoron_add_to_list(p_list uuid, p_publication uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.nitoron_lists l where l.id = p_list and l.owner_id = (select auth.uid())) then
    raise exception 'List is not owned by the caller' using errcode = '42501';
  end if;
  insert into public.nitoron_bookmarks(user_id, publication_id) values ((select auth.uid()), p_publication) on conflict do nothing;
  insert into public.nitoron_list_items(list_id, user_id, publication_id) values (p_list, (select auth.uid()), p_publication) on conflict do nothing;
end;
$$;
revoke all on function public.nitoron_add_to_list(uuid, uuid) from public, anon;
grant execute on function public.nitoron_add_to_list(uuid, uuid) to authenticated;

-- 共有ON/OFF：所有者だけが実行でき、ONのたびに新しいトークンを発行する（旧リンクは復活しない）。
create or replace function public.nitoron_set_list_sharing(p_list uuid, p_shared boolean)
returns public.nitoron_lists language plpgsql security definer set search_path = '' as $$
declare result public.nitoron_lists;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.nitoron_lists l where l.id = p_list and l.owner_id = (select auth.uid())) then
    raise exception 'List is not owned by the caller' using errcode = '42501';
  end if;
  update public.nitoron_lists set is_shared = p_shared, share_token = case when p_shared then gen_random_uuid() else null end
    where id = p_list returning * into result;
  return result;
end;
$$;
revoke all on function public.nitoron_set_list_sharing(uuid, boolean) from public, anon;
grant execute on function public.nitoron_set_list_sharing(uuid, boolean) to authenticated;

-- 共有リンクの閲覧：トークン・共有状態・公開状態を関数内で検証する。
-- 返すのは list の id・name・updated_at と、公開中の発表（id, owner_id, snapshot, is_public, published_at, updated_at）だけ。
-- メモ（nitoron_card_memos）は結合しない。非公開の発表は本文・件数・表紙のいずれにも含まれない。
-- 該当リストがなければ null（無効なリンクまたは共有停止）、共有中で発表がなければ items が空配列。
create or replace function public.nitoron_shared_list(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', l.id, 'name', l.name, 'updated_at', l.updated_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'owner_id', p.owner_id, 'snapshot', p.snapshot, 'is_public', p.is_public,
        'published_at', p.published_at, 'updated_at', p.updated_at) order by i.added_at desc, p.id)
      from public.nitoron_list_items i join public.nitoron_publications p on p.id = i.publication_id and p.is_public
      where i.list_id = l.id), '[]'::jsonb))
  from public.nitoron_lists l where p_token is not null and l.is_shared and l.share_token = p_token
$$;
revoke all on function public.nitoron_shared_list(uuid) from public;
grant execute on function public.nitoron_shared_list(uuid) to anon, authenticated;
notify pgrst, 'reload schema';
