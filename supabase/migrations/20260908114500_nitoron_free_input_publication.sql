-- Free-form input: a publication needs only a title.
-- Author, crop and summary become optional; their size caps stay.
alter table public.nitoron_publications drop constraint nitoron_snapshot_shape;
alter table public.nitoron_publications add constraint nitoron_snapshot_shape check (
  jsonb_typeof(snapshot) = 'object'
  and coalesce(snapshot->>'id' = id::text, false)
  and coalesce(jsonb_typeof(snapshot->'blocks') = 'array', false)
  and coalesce(jsonb_typeof(snapshot->'meta') = 'object', false)
  and coalesce(length(btrim(snapshot->>'title')) between 1 and 200, false)
  and coalesce(length(snapshot->'meta'->>'author') <= 160, true)
  and coalesce(length(snapshot->'meta'->>'crop') <= 160, true)
  and coalesce(length(snapshot->'meta'->>'summary') <= 2000, true)
);
notify pgrst, 'reload schema';
