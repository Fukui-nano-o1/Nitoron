-- Nitoron: 「試した結果」に添える本人の実践記録。既存の投稿は NULL のまま。
-- 付けられるのは、投稿者本人が所有し公開中の発表だけ（DB側で検証）。
-- 関連する発表が削除されたら NULL に戻し、報告本文は残す。公開停止は列を変えず、表示側が公開中のものだけを見せる。
alter table public.nitoron_feedback
  add column related_publication_id uuid references public.nitoron_publications(id) on delete set null;
create index nitoron_feedback_related_idx on public.nitoron_feedback(related_publication_id) where related_publication_id is not null;
drop policy nitoron_feedback_insert on public.nitoron_feedback;
create policy nitoron_feedback_insert on public.nitoron_feedback for insert to authenticated
  with check (user_id = (select auth.uid()) and (select nitoron_private.is_verified())
    and exists (select 1 from public.nitoron_publications p where p.id = publication_id and p.is_public)
    and (related_publication_id is null or exists (
      select 1 from public.nitoron_publications r where r.id = related_publication_id and r.owner_id = (select auth.uid()) and r.is_public)));
-- 投稿の更新経路はない（grant は insert/delete のみ）。更新を許す場合は同じ条件を with check に付けること。
revoke update on public.nitoron_feedback from public, anon, authenticated;
notify pgrst, 'reload schema';
