import { matches, normalize, number, METRICS } from './domain.js'
export const EMPTY_FILTERS = { crop: '', kind: 'all', stage: 'all', from: '', to: '', numbers: false }
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
