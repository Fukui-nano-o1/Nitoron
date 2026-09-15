import { normalize } from './domain.js'
import { ISSUE_WORDS, SYNONYM_GROUPS, suggestFromSynonyms, suggestPrefectures } from './synonyms.js'
// 最近の検索語は端末（localStorage）だけに持つ。サーバーへは送らない。
const RECENT_KEY = 'nitoron:recent-searches:v1', RECENT_MAX = 8
export function readRecent() {
  try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, RECENT_MAX) : [] } catch { return [] }
}
export function rememberSearch(query) {
  const q = String(query || '').trim().slice(0, 160)
  if (!q) return readRecent()
  const next = [q, ...readRecent().filter(x => x !== q)].slice(0, RECENT_MAX)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* 保持できなくても検索はできる */ }
  return next
}
export function clearRecent() { try { localStorage.removeItem(RECENT_KEY) } catch { /* noop */ } return [] }
const unique = items => { const seen = new Set(); return items.filter(x => { const k = normalize(x); if (!k || seen.has(k)) return false; seen.add(k); return true }) }
// キーワード候補：入力なし＝最近の検索＋よく使う語（データの作物・課題語）。入力あり＝前方一致を優先し、部分一致・同義語表からの候補を続ける。
// 候補は「最近」「作物」「課題」「関連する語」の区分つきで返す。件数は最大8。
export function suggestKeywords(input, { recent = [], crops = [] } = {}) {
  const n = normalize(input).trim()
  const tag = (kind, items) => items.map(value => ({ kind, value }))
  if (!n) return [...tag('recent', recent), ...tag('crop', unique(crops).slice(0, 6)), ...tag('issue', ISSUE_WORDS.slice(0, 6))].slice(0, 12)
  const starts = x => normalize(x).startsWith(n), includes = x => normalize(x).includes(n) && normalize(x) !== n
  const pool = [
    ...tag('recent', recent.filter(includes)),
    ...tag('crop', unique(crops).filter(starts)), ...tag('issue', ISSUE_WORDS.filter(starts)),
    ...tag('crop', unique(crops).filter(includes)), ...tag('issue', ISSUE_WORDS.filter(includes)),
    ...tag('synonym', suggestFromSynonyms(n).filter(w => normalize(w) !== n)),
  ]
  const seen = new Set()
  return pool.filter(s => { const k = normalize(s.value); if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 8)
}
// 地域候補：都道府県（漢字・かな前方一致）と、公開データにある地域名。
export function suggestRegions(input, { regions = [] } = {}) {
  const n = normalize(input).trim()
  if (!n) return unique(regions).slice(0, 8).map(value => ({ kind: 'region', value }))
  return unique([...suggestPrefectures(n), ...unique(regions).filter(x => normalize(x).includes(n))]).slice(0, 8).map(value => ({ kind: 'region', value }))
}
export const SUGGEST_LABELS = { recent: '最近の検索', crop: '作物', issue: '課題', synonym: '関連する語', region: '地域' }
export const synonymCanonicals = () => SYNONYM_GROUPS.map(g => g[0])
