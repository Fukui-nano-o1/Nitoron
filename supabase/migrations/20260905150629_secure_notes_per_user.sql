-- notes をユーザーごとに分離する。
-- 適用済み: Supabase プロジェクト "nitoron" (ycvbjzlqrxnwalhhgzat)

-- updated_at を更新時に自動で進める
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- 所有者カラム。ログイン機能導入前に作られた行があるため nullable とし、
-- 初回ログイン時にアプリが user_id is null の行を引き取る。
alter table public.notes
  add column user_id uuid default auth.uid() references auth.users (id) on delete cascade;

create index notes_user_id_idx on public.notes (user_id);

-- 全開放の anon ポリシーを廃止し、本人の行だけに限定する
drop policy "anon select" on public.notes;
drop policy "anon insert" on public.notes;
drop policy "anon update" on public.notes;
drop policy "anon delete" on public.notes;

create policy "own select" on public.notes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own insert" on public.notes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own update" on public.notes for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own delete" on public.notes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ログイン機能導入前の所有者なし行を、ログイン済みユーザーが自分のものとして引き取れる
create policy "claim ownerless" on public.notes for update to authenticated
  using (user_id is null) with check ((select auth.uid()) = user_id);
