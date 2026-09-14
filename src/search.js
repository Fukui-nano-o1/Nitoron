import { matches, normalize, number, METRICS, KINDS, PHASES } from './domain.js'
export const EMPTY_FILTERS = { crop: '', kind: 'all', stage: 'all', from: '', to: '', numbers: false }
// 「機械」はURL・JSだけの仮想分類。サーバーではカタログ解説・修理記録（trouble）と整備ガイド（learning）に展開する。発表は混ざらない。
export const MACHINE_KIND = 'machine', MACHINE_KINDS = ['trouble', 'learning']
// 機械コンテンツの meta.crop は執筆計画の分類名で書く（チップの部分一致で拾うための規約）。
export const MACHINE_CATEGORIES = ['トラクタ', 'コンバイン・バインダー・ハーベスタ', '田植機', '稲作関連機器', '管理機・テーラー・耕うん機', 'ミニ耕うん機', '野菜関連機器', '果樹関連機器', '草刈・防除機器', '乗用モーア']
// 探すの分類チップ。crop は部分一致（「トラクタ」は「トラクター」にも当たる）。0件の分類（果樹・乗用モーア）は最初の記録が入った時点で足す。
export const CHIPS = [
  ['トラクタ', { kind: 'machine', crop: 'トラクタ' }],
  ['コンバイン', { kind: 'machine', crop: 'コンバイン' }],
  ['田植機', { kind: 'machine', crop: '田植機' }],
  ['耕うん機・管理機', { kind: 'machine', crop: '耕うん機' }],
  ['野菜機械', { kind: 'machine', crop: '野菜' }],
  ['稲作関連', { kind: 'machine', crop: '稲作' }],
  ['草刈・防除', { kind: 'machine', crop: '草刈' }],
  ['経営発表', { kind: 'presentation', crop: '' }],
]
export const activeChip = filters => CHIPS.find(([, f]) => f.kind === filters.kind && f.crop === filters.crop) || null
export const discoverHref = state => { const qs = paramsFromList(state); return `#/discover${qs ? `?${qs}` : ''}` }
// 検索条件はURLを正とする。既定値はURLに書かず、読み戻し時は不正値を既定値へ丸める。
export function paramsFromList({ query = '', region = '', filters = EMPTY_FILTERS, sort = 'recent', page = 0 } = {}) {
  const p = new URLSearchParams()
  if (query.trim()) p.set('q', query)
  if (region.trim()) p.set('region', region)
  if (filters.crop.trim()) p.set('crop', filters.crop)
  if (filters.kind !== 'all') p.set('kind', filters.kind)
  if (filters.stage !== 'all') p.set('stage', filters.stage)
  if (filters.from) p.set('from', filters.from)
  if (filters.to) p.set('to', filters.to)
  if (filters.numbers) p.set('numbers', '1')
  if (sort !== 'recent') p.set('sort', sort)
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
      kind: Object.hasOwn(KINDS, p.get('kind')) || p.get('kind') === MACHINE_KIND ? p.get('kind') : 'all',
      stage: PHASES.includes(p.get('stage')) ? p.get('stage') : 'all',
      from: date(p.get('from')), to: date(p.get('to')),
      numbers: p.get('numbers') === '1',
    },
    sort: p.get('sort') === 'title' ? 'title' : 'recent',
    page: Number.isInteger(page) && page > 1 ? page - 1 : 0,
  }
}
export const hasNumbers = record => METRICS.some(([key]) => number(record.meta?.[key]) !== null)
const kindMatches = (kind, k) => kind === MACHINE_KIND ? MACHINE_KINDS.includes(k) : kind === k
export function filterRecord(record, { query = '', region = '', filters = EMPTY_FILTERS } = {}) {
  const m = record.meta
  return matches(record, query) && normalize(m?.region).includes(normalize(region).trim()) &&
    normalize(m?.crop || record.category).includes(normalize(filters.crop).trim()) &&
    (filters.kind === 'all' || kindMatches(filters.kind, m?.kind || 'memo')) &&
    (filters.stage === 'all' || m?.kind === 'challenge' && m.stage === filters.stage) &&
    (!filters.from || record.date >= filters.from) && (!filters.to || record.date <= filters.to) &&
    (!filters.numbers || hasNumbers(record))
}
export const countFilters = f => [f.crop, f.kind !== 'all', f.stage !== 'all', f.from, f.to, f.numbers].filter(Boolean).length
