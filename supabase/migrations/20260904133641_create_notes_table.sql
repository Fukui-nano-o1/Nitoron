-- notes: Nitoron のメモ本体。ブロックエディタの内容は blocks (jsonb) に格納する。
-- このマイグレーションは Supabase プロジェクト "nitoron" (ycvbjzlqrxnwalhhgzat) に適用済み。
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  category text not null default '未分類',
  type text not null default 'メモ',
  date date not null default current_date,
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

-- 認証機能を入れるまでは anon キーでの読み書きを許可する(公開キーは RLS 前提)。
create policy "anon select" on public.notes for select to anon using (true);
create policy "anon insert" on public.notes for insert to anon with check (true);
create policy "anon update" on public.notes for update to anon using (true) with check (true);
create policy "anon delete" on public.notes for delete to anon using (true);
