-- 探す：全文検索の高速化（トライグラム索引）と、関連度順・件数・内訳をサーバー側で1往復にする検索関数。
-- 既存の列・RLS・権限は変えない。関数は公開中の発表だけを返す。
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create index if not exists nitoron_publications_search_trgm_idx on public.nitoron_publications using gin (search_text extensions.gin_trgm_ops) where is_public;
create index if not exists nitoron_publications_title_trgm_idx on public.nitoron_publications using gin (title_search extensions.gin_trgm_ops) where is_public;

-- LIKE 用のエスケープ（% _ \）。
create or replace function nitoron_private.like_escape(value text)
returns text language sql immutable set search_path = '' as $$
  select replace(replace(replace(coalesce(value, ''), '\', '\\'), '%', '\%'), '_', '\_');
$$;
revoke all on function nitoron_private.like_escape(text) from public, anon;
grant execute on function nitoron_private.like_escape(text) to authenticated;

-- 検索関数。p_terms は [[候補語,...], ...]（各要素＝1語の同義語候補。語ごとに「いずれかを含む」を AND でつなぐ）。
-- 公開中（is_public）の行だけを対象にし、RLSに依らず明示的に絞る。security definer は search_normalize（anon 実行不可）を使うため。
-- 返り値: {count, rows:[{id,owner_id,snapshot,is_public,published_at,updated_at,score}], facets:{crops:[{value,count}], regions:[...], kinds:[...]}}
create or replace function public.nitoron_search(
  p_terms jsonb default '[]'::jsonb, p_region text default '', p_crop text default '',
  p_kind text default '', p_stage text default '', p_from text default '', p_to text default '',
  p_numbers boolean default false, p_sort text default 'relevance', p_offset integer default 0, p_limit integer default 24)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_region text := nitoron_private.like_escape(nitoron_private.search_normalize(btrim(coalesce(p_region, ''))));
  v_crop text := nitoron_private.like_escape(nitoron_private.search_normalize(btrim(coalesce(p_crop, ''))));
  v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 48);
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 10000);
  v_sort text := case when p_sort in ('relevance', 'recent', 'title') then p_sort else 'relevance' end;
  v_terms jsonb;
  v_result jsonb;
begin
  if p_terms is null or jsonb_typeof(p_terms) <> 'array' or jsonb_array_length(p_terms) > 8 then
    raise exception 'invalid search terms' using errcode = '22023';
  end if;
  if p_from <> '' and p_from !~ '^\d{4}-\d{2}-\d{2}$' or p_to <> '' and p_to !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'invalid date' using errcode = '22023';
  end if;
  -- 候補語を正規化してLIKE用のパターンにする（各語 最大12候補、各候補 最大80文字）。[[pattern,...], ...]
  select coalesce(jsonb_agg(alts), '[]'::jsonb) into v_terms from (
    select (select jsonb_agg('%' || nitoron_private.like_escape(nitoron_private.search_normalize(left(a, 80))) || '%')
            from jsonb_array_elements_text(case when jsonb_typeof(g) = 'array' then g else jsonb_build_array(g) end) with ordinality as t(a, i)
            where i <= 12 and btrim(a) <> '') as alts
    from jsonb_array_elements(p_terms) g) x where alts is not null;
  with matched as materialized (
    select p.id, p.owner_id, p.snapshot, p.is_public, p.published_at, p.updated_at, p.title_search, p.crop_search, p.region_search,
      (select coalesce(sum(
        greatest(
          (select max(case when p.title_search like alt then 8 else 0 end) from jsonb_array_elements_text(g) alt),
          (select max(case when p.crop_search like alt then 4 else 0 end) from jsonb_array_elements_text(g) alt),
          (select max(case when nitoron_private.search_normalize(p.snapshot->'meta'->>'summary') like alt then 2 else 0 end) from jsonb_array_elements_text(g) alt),
          1)), 0)
       from jsonb_array_elements(v_terms) g) as score
    from public.nitoron_publications p
    where p.is_public
      and (v_region = '' or p.region_search like '%' || v_region || '%')
      and (v_crop = '' or p.crop_search like '%' || v_crop || '%')
      and (p_kind = '' or p.snapshot->'meta'->>'kind' = p_kind)
      and (p_stage = '' or (p.snapshot->'meta'->>'kind' = 'challenge' and p.snapshot->'meta'->>'stage' = p_stage))
      and (p_from = '' or p.snapshot->>'date' >= p_from)
      and (p_to = '' or p.snapshot->>'date' <= p_to)
      and (not p_numbers or p.has_metrics)
      and not exists (
        select 1 from jsonb_array_elements(v_terms) g
        where not exists (select 1 from jsonb_array_elements_text(g) alt where p.search_text like alt))
  )
  select jsonb_build_object(
    'count', (select count(*) from matched),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'owner_id', r.owner_id, 'snapshot', r.snapshot, 'is_public', r.is_public,
        'published_at', r.published_at, 'updated_at', r.updated_at, 'score', r.score) order by r.rn), '[]'::jsonb)
      from (select m.*, row_number() over (order by
          case when v_sort = 'relevance' then m.score end desc nulls last,
          case when v_sort = 'title' then m.title_search end asc nulls last,
          case when v_sort <> 'title' then m.updated_at end desc nulls last, m.id) as rn
        from matched m) r where r.rn > v_offset and r.rn <= v_offset + v_limit),
    'facets', jsonb_build_object(
      'crops', (select coalesce(jsonb_agg(jsonb_build_object('value', f.value, 'count', f.n) order by f.n desc, f.value), '[]'::jsonb)
        from (select min(m.snapshot->'meta'->>'crop') as value, count(*) as n from matched m where m.crop_search <> '' group by m.crop_search order by n desc, min(m.snapshot->'meta'->>'crop') limit 8) f),
      'regions', (select coalesce(jsonb_agg(jsonb_build_object('value', f.value, 'count', f.n) order by f.n desc, f.value), '[]'::jsonb)
        from (select min(m.snapshot->'meta'->>'region') as value, count(*) as n from matched m where m.region_search <> '' group by m.region_search order by n desc, min(m.snapshot->'meta'->>'region') limit 8) f),
      'kinds', (select coalesce(jsonb_agg(jsonb_build_object('value', f.value, 'count', f.n) order by f.n desc, f.value), '[]'::jsonb)
        from (select coalesce(m.snapshot->'meta'->>'kind', 'memo') as value, count(*) as n from matched m group by 1) f)))
  into v_result;
  return v_result;
end;
$$;
revoke all on function public.nitoron_search(jsonb, text, text, text, text, text, text, boolean, text, integer, integer) from public;
grant execute on function public.nitoron_search(jsonb, text, text, text, text, text, text, boolean, text, integer, integer) to anon, authenticated;
