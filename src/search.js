import { matches, normalize, number, METRICS, KINDS, PHASES } from './domain.js'
export const EMPTY_FILTERS = { crop: '', kind: 'all', stage: 'all', from: '', to: '', numbers: false }
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
      kind: Object.hasOwn(KINDS, p.get('kind')) ? p.get('kind') : 'all',
      stage: PHASES.includes(p.get('stage')) ? p.get('stage') : 'all',
      from: date(p.get('from')), to: date(p.get('to')),
      numbers: p.get('numbers') === '1',
    },
    sort: p.get('sort') === 'title' ? 'title' : 'recent',
    page: Number.isInteger(page) && page > 1 ? page - 1 : 0,
  }
}
export const hasNumbers = record => METRICS.some(([key]) => number(record.meta?.[key]) !== null)
export function filterRecord(record, { query = '', region = '', filters = EMPTY_FILTERS } = {}) {
  const m = record.meta
  return matches(record, query) && normalize(m?.region).includes(normalize(region).trim()) &&
    normalize(m?.crop || record.category).includes(normalize(filters.crop).trim()) &&
    (filters.kind === 'all' || (m?.kind || 'memo') === filters.kind) &&
    (filters.stage === 'all' || m?.kind === 'challenge' && m.stage === filters.stage) &&
    (!filters.from || record.date >= filters.from) && (!filters.to || record.date <= filters.to) &&
    (!filters.numbers || hasNumbers(record))
}
export const countFilters = f => [f.crop, f.kind !== 'all', f.stage !== 'all', f.from, f.to, f.numbers].filter(Boolean).length
