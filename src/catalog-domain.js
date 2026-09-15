import { normalize, queryTerms, termVariants } from './domain.js'
// カタログ解説（【カタログ解説】メーカー 型式 製品名（分類））の読み取りと、詳細ページの節・関連行・記録内検索。
// メーカー・型式・シリーズは記録の題名から読む（記録の形は変えない）。
export const CATALOG_PREFIX = '【カタログ解説】'
export const isCatalogRecord = r => r?.meta?.kind === 'trouble' && r.meta?.subject !== 'machine_repair' && String(r.title || '').startsWith(CATALOG_PREFIX)
// 型式の英字部分がシリーズ（TMS-200 → TMS、KP-103 → KP、SKP-101W → SKP）。
export const seriesOf = model => { const s = /^[A-Za-z]+/.exec(String(model || '').trim()); return s ? s[0].toUpperCase() : '' }
export function parseCatalogTitle(title) {
  const m = /^【カタログ解説】\s*(\S+)\s+(\S+)(?:\s+([^（(]*?))?\s*(?:[（(]([^）)]+)[）)])?\s*$/.exec(String(title || '').trim())
  if (!m) return null
  return { maker: m[1], model: m[2], series: seriesOf(m[2]), name: (m[3] || '').trim(), category: (m[4] || '').trim() }
}
// 最下部の関連行：同じシリーズ → 同じメーカー。検索語は全文検索（語ごとの AND）で当てる。
export function relatedRows(record) {
  const p = parseCatalogTitle(record?.title)
  if (!p) return []
  const rows = []
  if (p.series) rows.push({ key: 'series', label: `${p.maker} ${p.series}シリーズのカタログ解説`, query: `${CATALOG_PREFIX.slice(1, -1)} ${p.maker} ${p.series}-` })
  rows.push({ key: 'maker', label: `${p.maker}のカタログ解説`, query: `${CATALOG_PREFIX.slice(1, -1)} ${p.maker}` })
  return rows
}
// 本文の h2 を節にする。節の id は見出しブロックの id から作る（ナビの飛び先）。
export const sectionId = block => `sec-${block.id}`
export function sectionsOf(blocks) {
  return (blocks || []).filter(b => b && b.type === 'h2' && String(b.text || '').trim()).map(b => ({ id: sectionId(b), title: b.text.trim() }))
}
// 節の中身を h3 ごとの組にする（h3 の前の行は見出しなしの組）。折りたたみと検索の単位。
export function groupSection(blocks) {
  const groups = []
  for (const b of blocks || []) {
    if (!b || b.type === 'h2') continue
    if (b.type === 'h3') { groups.push({ head: b, rows: [] }); continue }
    if (!groups.length) groups.push({ head: null, rows: [] })
    groups[groups.length - 1].rows.push(b)
  }
  return groups
}
const hit = (text, terms) => { const t = normalize(text); return terms.every(term => termVariants(term).some(v => t.includes(v))) }
// 記録内検索：語は空白区切りの AND（全文検索と同じ正規化・型式ゆらぎ）。h3 が当たれば組ごと、行が当たれば h3 を添えて行だけ残す。
// 戻り値は当たった節だけ。total は当たった行数（h3 の見出し行を含む）。
export function searchSections(blocks, query) {
  const terms = queryTerms(query)
  if (!terms.length) return null
  return filterSections(blocks, text => hit(text, terms))
}
// 条件（行の本文で判定）に合う節・組・行だけを残す。検索と「この頁を引く行」で共用。
function filterSections(blocks, pred) {
  const out = []
  let current = null
  for (const b of blocks || []) {
    if (b?.type === 'h2' && String(b.text || '').trim()) { current = { id: sectionId(b), title: b.text.trim(), groups: [], total: 0 }; out.push(current); continue }
    if (!current) { current = { id: 'sec-lead', title: '', groups: [], total: 0 }; out.push(current) }
    current.raw = current.raw || []; current.raw.push(b)
  }
  for (const s of out) {
    for (const g of groupSection(s.raw)) {
      const headHit = g.head && pred(g.head.text)
      const rows = headHit ? g.rows.filter(b => b.text && b.type !== 'divider') : g.rows.filter(b => b.text && b.type !== 'divider' && pred(b.text))
      if (headHit || rows.length) { s.groups.push({ head: g.head, rows }); s.total += rows.length + (headHit ? 1 : 0) }
    }
    delete s.raw
  }
  return out.filter(s => s.total)
}
// 当たった語を <mark> で示すための分割。正規化前の文字列上で、正規化後の位置を対応させる（NFKC で長さが変わる文字は稀なので、ずれた場合は強調なしで返す）。
export function highlightParts(text, query) {
  const terms = queryTerms(query).flatMap(termVariants).filter(Boolean)
  const raw = String(text || ''), norm = normalize(raw)
  if (!terms.length || norm.length !== raw.length) return [{ text: raw, mark: false }]
  const marks = new Array(raw.length).fill(false)
  for (const term of terms) { let i = norm.indexOf(term); while (i >= 0) { for (let k = i; k < i + term.length; k++) marks[k] = true; i = norm.indexOf(term, i + 1) } }
  const parts = []
  for (let i = 0; i < raw.length; i++) { const last = parts[parts.length - 1]; if (last && last.mark === marks[i]) last.text += raw[i]; else parts.push({ text: raw[i], mark: marks[i] }) }
  return parts
}
// 取扱説明書の頁の引用。本文には「（印刷p.56／PDF 62）」の形（頁数の根拠）と「やり方は印刷p.46」の形（参照）がある。
// 印刷頁→PDF頁の差（本文の印刷頁 = PDF頁 − offset）は、記録の中の完全形の引用から求める（記録の形は変えない）。
const CITE = /（印刷p\.(\d+)(?:〜\d+)?／PDF (\d+)）|印刷p\.(\d+)(?:〜\d+)?/g
export function manualOffset(blocks) {
  const counts = new Map()
  for (const b of blocks || []) for (const m of String(b?.text || '').matchAll(CITE)) if (m[2]) { const d = Number(m[2]) - Number(m[1]); counts.set(d, (counts.get(d) || 0) + 1) }
  let best = null
  for (const [d, n] of counts) if (best === null || n > counts.get(best)) best = d
  return best
}
// 本文を、引用の部分（printed・pdf つき）とそれ以外に分ける。参照形は offset があるときだけ pdf を持つ。
export function citeParts(text, offset) {
  const raw = String(text || ''), parts = []
  let last = 0
  for (const m of raw.matchAll(CITE)) {
    if (m.index > last) parts.push({ text: raw.slice(last, m.index) })
    const printed = Number(m[1] ?? m[3]), pdf = m[2] ? Number(m[2]) : offset == null ? null : printed + offset
    parts.push({ text: m[0], printed, pdf })
    last = m.index + m[0].length
  }
  if (last < raw.length || !parts.length) parts.push({ text: raw.slice(last) })
  return parts
}
const citesOf = (text, offset) => citeParts(text, offset).filter(p => p.pdf != null)
// 記録が引いた頁の一覧（印刷頁の昇順、引いた行数つき）。
export function citedPages(blocks) {
  const offset = manualOffset(blocks), pages = new Map()
  for (const b of blocks || []) for (const c of new Set(citesOf(b?.text, offset).map(c => c.printed))) { const row = pages.get(c) || { printed: c, pdf: c + offset, count: 0 }; row.count++; pages.set(c, row) }
  return [...pages.values()].sort((a, b) => a.printed - b.printed)
}
// 指定の印刷頁を引いている節・行だけ。
export const sectionsCitingPage = (blocks, printed, offset = manualOffset(blocks)) => filterSections(blocks, text => citesOf(text, offset).some(c => c.printed === printed))
export const manualPageHref = (id, pdf) => `#/public/${id}/manual/${pdf}`
// 出典のうち取扱説明書（メーカーの案内ページ）を探す。頁ページの出典表示に使う（リンクにはしない）。
export function manualSource(record) {
  const s = (record?.meta?.sources || []).find(x => /\/manual\/notice\.html\?hash=/.test(x.url || '')) || (record?.meta?.sources || []).find(x => /\.pdf($|\?)/i.test(x.url || ''))
  if (!s) return null
  return { title: s.title || '取扱説明書', url: s.url }
}
