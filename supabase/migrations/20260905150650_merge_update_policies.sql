-- UPDATE の permissive ポリシーを1つに統合(パフォーマンスリンター対応)
drop policy "own update" on public.notes;
drop policy "claim ownerless" on public.notes;

create policy "own update" on public.notes for update to authenticated
  using (user_id is null or (select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
