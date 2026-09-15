import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { newRecord, snapshot } from '../src/domain.js'
import { expandQuery } from '../src/synonyms.js'
const OWNER = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222'
const id = n => `${String(n).padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`
test('検索関数：同義語のOR、関連度順、件数・内訳、公開のみ、権限', async t => {
  const db = new PGlite({ extensions: { pg_trgm } })
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, is_anonymous boolean, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('${OWNER}',false,now()),('${OTHER}',false,now());
      create table public.notes(id uuid primary key, user_id uuid not null references auth.users(id), title text, blocks jsonb);
      alter table notes enable row level security;grant select,insert,update,delete on notes to authenticated;
      create policy notes_owner on notes to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, unique(bucket_id,name));
      create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
      grant usage on schema storage to anon,authenticated;grant select on storage.objects to anon;grant select,insert,delete on storage.objects to authenticated;
      alter table storage.objects enable row level security;`)
    for (const file of ['20260907034224_nitoron_publications_and_feedback.sql', '20260908110127_nitoron_files_saved_and_dialogue.sql', '20260915100000_nitoron_search_index.sql'])
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
    const as = async (who, sql, params = []) => {
      await db.exec(`set role ${who ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub','${who || ''}',false);`)
      try { return await db.query(sql, params) } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);") }
    }
    const rows = [
      [1, OWNER, true, { title: '育苗ハウスの温度管理', crop: 'ブロッコリー', region: '徳島県', summary: '苗の徒長を防ぐ', date: '2026-05-01', kind: 'presentation' }],
      [2, OWNER, true, { title: 'ブロッコリーの収量改善', crop: 'ブロッコリー', region: '香川県', summary: '要約', text: '播種の時期をずらした', date: '2026-06-01', kind: 'presentation' }],
      [3, OTHER, true, { title: '水稲の直播', crop: '水稲', region: '新潟県', summary: '要約', date: '2026-07-01', kind: 'challenge', stage: '実践中', hours: '12' }],
      [4, OTHER, true, { title: '排水対策の記録', crop: 'キャベツ', region: '愛知県', summary: '要約', text: '苗づくりの失敗', date: '2026-08-01', kind: 'trouble' }],
      [5, OTHER, false, { title: '非公開の育苗メモ', crop: 'トマト', region: '徳島県', summary: '要約', date: '2026-09-01', kind: 'presentation' }],
    ]
    for (const [n, owner, pub, f] of rows) {
      await db.query('insert into notes values($1,$2,$3,$4)', [id(n), owner, f.title, '[]'])
      const r = newRecord(); r.id = id(n); r.title = f.title; r.date = f.date
      if (f.text) r.blocks = [{ id: 'b1', type: 'text', text: f.text }]
      Object.assign(r.meta, { author: '発表者', crop: f.crop, region: f.region, summary: f.summary, kind: f.kind, stage: f.stage || '仮説', hours: f.hours || '' })
      await as(owner, 'insert into nitoron_publications(id,owner_id,snapshot,is_public) values($1,$2,$3,$4)', [id(n), owner, snapshot(r), pub])
    }
    const search = async (who, args = {}) => {
      const a = { p_terms: '[]', p_region: '', p_crop: '', p_kind: '', p_stage: '', p_from: '', p_to: '', p_numbers: false, p_sort: 'relevance', p_offset: 0, p_limit: 24, ...args }
      const r = await as(who, 'select public.nitoron_search($1::jsonb,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as r',
        [typeof a.p_terms === 'string' ? a.p_terms : JSON.stringify(a.p_terms), a.p_region, a.p_crop, a.p_kind, a.p_stage, a.p_from, a.p_to, a.p_numbers, a.p_sort, a.p_offset, a.p_limit])
      return r.rows[0].r
    }
    const terms = q => expandQuery(q).map(t => t.alternatives)
    await t.test('索引が作られ、匿名でも実行できる', async () => {
      const idx = await db.query("select indexname from pg_indexes where tablename='nitoron_publications' and indexname like '%trgm%'")
      assert.deepEqual(idx.rows.map(r => r.indexname).sort(), ['nitoron_publications_search_trgm_idx', 'nitoron_publications_title_trgm_idx'])
      const all = await search(null)
      assert.equal(all.count, 4)
      assert.deepEqual(all.rows.map(r => r.id), [id(4), id(3), id(2), id(1)], '語なしは新しい順')
    })
    await t.test('同義語の候補（育苗→苗・播種…）をORで探し、AND で語をつなぐ', async () => {
      const r = await search(null, { p_terms: terms('育苗') })
      // 1: タイトル「育苗」, 2: 本文「播種」, 4: 本文「苗づくり」。5は非公開なので出ない。
      assert.deepEqual(r.rows.map(x => x.id), [id(1), id(4), id(2)], 'タイトル一致が先頭、同点は新しい順')
      assert.equal(r.count, 3)
      const both = await search(null, { p_terms: terms('育苗 ブロッコリー') })
      assert.deepEqual(both.rows.map(x => x.id).sort(), [id(1), id(2)].sort())
      const exact = await search(null, { p_terms: [['育苗']] })
      assert.deepEqual(exact.rows.map(x => x.id), [id(1)], '展開なしはその語だけ')
    })
    await t.test('関連度：タイトル > 作物 > 要約 > 本文', async () => {
      const r = await search(null, { p_terms: [['ブロッコリー']] })
      assert.equal(r.rows[0].id, id(2)); assert.equal(r.rows[0].score, 8)
      assert.equal(r.rows[1].id, id(1)); assert.equal(r.rows[1].score, 4)
      const s = await search(null, { p_terms: [['苗']] })
      assert.equal(s.rows.find(x => x.id === id(1)).score, 8, 'タイトル「育苗」に苗を含む')
      assert.equal(s.rows.find(x => x.id === id(4)).score, 1, '本文だけ')
    })
    await t.test('条件（地域・作物・分類・進捗・日付・数字）と件数・内訳', async () => {
      assert.equal((await search(null, { p_region: '徳島' })).count, 1, '非公開の徳島は数えない')
      assert.equal((await search(null, { p_crop: 'ぶろっこり' })).count, 2, '作物はかな・カナを同一視')
      assert.equal((await search(null, { p_kind: 'challenge' })).count, 1)
      assert.equal((await search(null, { p_stage: '実践中' })).count, 1)
      assert.equal((await search(null, { p_from: '2026-07-01', p_to: '2026-08-01' })).count, 2)
      assert.equal((await search(null, { p_numbers: true })).count, 1)
      const f = (await search(null)).facets
      assert.deepEqual(f.crops.slice(0, 1), [{ value: 'ブロッコリー', count: 2 }])
      assert.equal(f.crops.length, 3); assert.equal(f.regions.length, 4)
      assert.deepEqual(f.kinds.find(k => k.value === 'presentation'), { value: 'presentation', count: 2 })
      assert.equal(f.crops.some(c => c.value === 'トマト'), false, '非公開は内訳にも出ない')
    })
    await t.test('並び順・ページ・上限', async () => {
      const t1 = await search(null, { p_sort: 'title' })
      assert.equal(t1.rows[0].id, id(2), 'タイトル順（正規化）')
      const p2 = await search(null, { p_sort: 'recent', p_offset: 2, p_limit: 1 })
      assert.deepEqual(p2.rows.map(x => x.id), [id(2)]); assert.equal(p2.count, 4)
      assert.equal((await search(null, { p_limit: 1000 })).rows.length, 4)
      await assert.rejects(search(null, { p_terms: '"x"' }), /invalid search terms/)
      await assert.rejects(search(null, { p_from: 'junk' }), /invalid date/)
      const wild = await search(null, { p_terms: [['%']] })
      assert.equal(wild.count, 0, 'LIKEの特殊文字は文字として扱う')
    })
    await t.test('所有者本人でも非公開は検索結果に出ない', async () => {
      const r = await search(OTHER, { p_terms: [['非公開']] })
      assert.equal(r.count, 0)
    })
  } finally { await db.close() }
})
