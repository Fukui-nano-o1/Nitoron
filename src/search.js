import { matches, normalize, number, recordText, METRICS, KINDS, PHASES } from './domain.js'
import { expandQuery } from './synonyms.js'
export const EMPTY_FILTERS = { crop: '', kind: 'all', stage: 'all', from: '', to: '', numbers: false }
// 検索条件はURLを正とする。既定値はURLに書かず、読み戻し時は不正値を既定値へ丸める。
export function paramsFromList({ query = '', region = '', filters = EMPTY_FILTERS, sort = 'recent', page = 0, exact = false } = {}) {
  const p = new URLSearchParams()
  if (query.trim()) p.set('q', query)
  if (region.trim()) p.set('region', region)
  if (filters.crop.trim()) p.set('crop', filters.crop)
  if (filters.kind !== 'all') p.set('kind', filters.kind)
  if (filters.stage !== 'all') p.set('stage', filters.stage)
  if (filters.from) p.set('from', filters.from)
  if (filters.to) p.set('to', filters.to)
  if (filters.numbers) p.set('numbers', '1')
  if (exact && query.trim()) p.set('exact', '1')
  // 検索語がないとき関連度順は意味を持たないので、新しい順として扱う。
  const effective = sort === 'relevance' && !query.trim() ? 'recent' : sort
  if (effective !== defaultSort(query)) p.set('sort', effective)
  if (page > 0) p.set('page', String(page + 1))
  return p.toString()
}
export function listFromParams(params) {
  const p = new URLSearchParams(params || '')
  const page = Number(p.get('page'))
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : ''
  return {
    query: (p.get('q') || '').slice(0, 160), region: (p.get('region') || '').slice(0, 80),
    filters: {
      crop: (p.get('crop') || '').slice(0, 80),
      kind: Object.hasOwn(KINDS, p.get('kind')) ? p.get('kind') : 'all',
      stage: PHASES.includes(p.get('stage')) ? p.get('stage') : 'all',
      from: date(p.get('from')), to: date(p.get('to')),
      numbers: p.get('numbers') === '1',
    },
    sort: ['title', 'recent'].includes(p.get('sort')) || p.get('sort') === 'relevance' && (p.get('q') || '').trim() ? p.get('sort') : defaultSort(p.get('q') || ''),
    page: Number.isInteger(page) && page > 1 ? page - 1 : 0,
    exact: p.get('exact') === '1' && !!(p.get('q') || '').trim(),
  }
}
export const hasNumbers = record => METRICS.some(([key]) => number(record.meta?.[key]) !== null)
// 同義語を含めた一致（自分の記録の絞り込み用）。各語について、展開した候補語のいずれかを含めばよい。
export function matchesExpanded(record, query, exact = false) {
  const haystack = normalize(recordText(record))
  return expandQuery(query, exact).every(({ alternatives }) => !alternatives.length || alternatives.some(a => haystack.includes(a)))
}
export function filterRecord(record, { query = '', region = '', filters = EMPTY_FILTERS, exact = false } = {}) {
  const m = record.meta
  return matchesExpanded(record, query, exact) && normalize(m?.region).includes(normalize(region).trim()) &&
    normalize(m?.crop || record.category).includes(normalize(filters.crop).trim()) &&
    (filters.kind === 'all' || (m?.kind || 'memo') === filters.kind) &&
    (filters.stage === 'all' || m?.kind === 'challenge' && m.stage === filters.stage) &&
    (!filters.from || record.date >= filters.from) && (!filters.to || record.date <= filters.to) &&
    (!filters.numbers || hasNumbers(record))
}
// 並び順の既定：検索語があれば関連度、なければ新しい順。
export const defaultSort = query => String(query || '').trim() ? 'relevance' : 'recent'
export const SORTS = [['relevance', '関連度順'], ['recent', '新しい順'], ['title', 'タイトル順']]
// 関連度：語ごとに、一致した最上位の欄の重み（タイトル8 > 作物4 > 要約2 > 本文・観測1）を足す。サーバー側関数と同じ規則。
// 同点は元の順（新しさ）。ページ内の並べ替えに使う（全件横断の順位はサーバー側関数で行う）。
export function relevanceScore(record, query, exact = false) {
  const terms = expandQuery(query, exact)
  if (!terms.length) return 0
  const m = record.meta || {}
  const fields = [[normalize(record.title), 8], [normalize(m.crop), 4], [normalize(m.summary), 2], [normalize([...(record.blocks || []).map(b => b.text), ...(m.observations || []).map(o => o.fact), ...['issue', 'hypothesis', 'action', 'result', 'interpretation', 'learning'].map(k => m[k])].join(' ')), 1]]
  let score = 0
  for (const { alternatives } of terms) score += Math.max(0, ...fields.filter(([text]) => alternatives.some(a => a && text.includes(a))).map(([, weight]) => weight))
  return score
}
export const rankRecords = (records, query, exact = false) => [...records].map((r, i) => ({ r, i, s: relevanceScore(r, query, exact) })).sort((a, b) => b.s - a.s || a.i - b.i).map(x => x.r)
// 一致箇所の抜粋（前後を含めて短く）。表示用で、保存はしない。
export function snippet(record, query, exact = false, width = 40) {
  const terms = expandQuery(query, exact).flatMap(t => t.alternatives)
  if (!terms.length) return null
  const m = record.meta || {}
  const sources = [m.summary, ...(record.blocks || []).map(b => b.text), ...(m.observations || []).map(o => o.fact), m.issue, m.hypothesis, m.action, m.result, m.interpretation, m.learning].filter(Boolean)
  for (const text of sources) {
    const lower = normalize(text)
    // 正規化で文字数が変わる文（全角英数など）は位置がずれるので、長さが同じときだけ抜粋する。
    if (lower.length !== text.length) continue
    for (const term of terms) {
      const at = lower.indexOf(term)
      if (at < 0) continue
      const start = Math.max(0, at - width), end = Math.min(text.length, at + term.length + width)
      return { before: (start > 0 ? '…' : '') + text.slice(start, at), match: text.slice(at, at + term.length), after: text.slice(at + term.length, end) + (end < text.length ? '…' : '') }
    }
  }
  return null
}
// 0件のとき「この条件を外すと◯件」を提案するための、外せる条件の一覧。
export function relaxations({ query = '', region = '', filters = EMPTY_FILTERS, exact = false } = {}) {
  const terms = String(query).trim().split(/\s+/).filter(Boolean), out = []
  if (terms.length > 1) for (const t of terms) out.push({ key: `term:${t}`, label: `「${t}」を外す`, patch: { query: terms.filter(x => x !== t).join(' ') } })
  else if (terms.length === 1) out.push({ key: 'query', label: `「${terms[0]}」を外す`, patch: { query: '' } })
  if (exact && terms.length) out.push({ key: 'exact', label: '同義語も含める', patch: { exact: false } })
  if (region.trim()) out.push({ key: 'region', label: `地域「${region.trim()}」を外す`, patch: { region: '' } })
  if (filters.crop.trim()) out.push({ key: 'crop', label: `作物「${filters.crop.trim()}」を外す`, patch: { filters: { ...filters, crop: '' } } })
  if (filters.stage !== 'all') out.push({ key: 'stage', label: `進捗「${filters.stage}」を外す`, patch: { filters: { ...filters, stage: 'all' } } })
  else if (filters.kind !== 'all') out.push({ key: 'kind', label: `分類「${KINDS[filters.kind]}」を外す`, patch: { filters: { ...filters, kind: 'all' } } })
  if (filters.from || filters.to) out.push({ key: 'dates', label: '記録日の範囲を外す', patch: { filters: { ...filters, from: '', to: '' } } })
  if (filters.numbers) out.push({ key: 'numbers', label: '「経営の数字がある記録」を外す', patch: { filters: { ...filters, numbers: false } } })
  return out.length >= 2 ? out : []
}
export const countFilters = f => [f.crop, f.kind !== 'all', f.stage !== 'all', f.from, f.to, f.numbers].filter(Boolean).length
// 記録日のプリセット。今シーズン＝直近の4月1日から（作付け年度）。終了日は空＝今日まで。
export const DATE_PRESETS = [['season', '今シーズン'], ['year', 'この1年'], ['quarter', '過去3か月'], ['none', '期間なし']]
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export function datePreset(key, today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (key === 'season') return { from: iso(new Date(d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, 3, 1)), to: '' }
  if (key === 'year') { d.setFullYear(d.getFullYear() - 1); return { from: iso(d), to: '' } }
  if (key === 'quarter') { d.setMonth(d.getMonth() - 3); return { from: iso(d), to: '' } }
  return { from: '', to: '' }
}
