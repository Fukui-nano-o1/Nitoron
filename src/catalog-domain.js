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

// ---- カタログ解説の詳細ページの構成（表示時に組み立てる。記録の形＝h2 ごとの本文は変えない）
// 順序：症状から診断する → 整備の周期 → 部品と費用 → 諸元（エンジン・走行部・作業部…）→ 部品の名称 → 操作方法 → 安全 → 照合 → 未確認。
// 転記の並べ替えではなく、症状→確認箇所→修理記録、部品→品番→記録された費用、へ読者を運ぶための構成。
const ORDER = ['症状から探す', '整備と点検', '部品と費用', 'エンジン', '動力', '走行部', '作業部', '植付部', '部品の名称', '操作方法', '安全に使うために', '製品ページと取扱説明書の照合', '未確認']
const SPEC_TITLES = ['エンジン', '動力', '走行部', '作業部', '植付部']
export const PART_NUMBER = /[A-Z]{1,3}\d{2,4}-\d{4,5}(?:-\d)?|\b\d{5}-\d{5}\b/g
const CITE_ANY = /（印刷p\.\d+(?:[〜~]\d+)?／PDF \d+）/g
// 引用の頁と、「 — 」以降の補足（交換の目安・やり方の頁）を落とした本文。表の材料にする。
export const stripCite = text => String(text || '').replace(CITE_ANY, '').replace(/\s+—\s.*$/, '').trim()
const rank = s => { const key = s.kind === 'diagnosis' ? '症状から探す' : s.kind === 'schedule' ? '整備と点検' : s.kind === 'parts' ? '部品と費用' : s.title; const i = ORDER.findIndex(t => key.startsWith(t)); return i < 0 ? ORDER.length : i }
// 「定期点検箇所一覧表：A（x）／B（y）…」を行に分ける。括弧の中が周期。
export function scheduleRows(text) {
  const body = stripCite(text).replace(/^[^：]*：/, '')
  return body.split('／').map(seg => seg.trim()).filter(Boolean).map(seg => { const m = /^(.*?)（([^（）]*)）$/.exec(seg); return m ? { item: m[1].trim(), interval: m[2].trim() } : { item: seg, interval: '' } })
}
// 「label：value（印刷p.x／PDF y）」を行にする（諸元の表）。
export const specRow = text => { const m = /^([^：]{1,40})：(.*)$/.exec(stripCite(text)); return m ? { label: m[1].trim(), value: m[2].trim() } : null }
// 本文の中の品番（クボタ形式：LK161-62210、LE010-1378-0、07908-67640）を拾い、部品名と組にする。
// 前書き（最初の h2 より前：取扱説明書の資料番号が載る）は除く。「取扱説明書 LK231-6512-3」のような資料番号も部品ではない。
// 「スパークプラグ LE010-11970（FTR70）／LE010-12830（FTR90）」のように名前が省かれた続きの品番は、直前の名前を引き継ぐ。
export function partRows(blocks) {
  const rows = [], seen = new Set()
  let inBody = false
  for (const b of blocks || []) {
    if (b?.type === 'h2') { inBody = true; continue }
    if (!inBody || !b?.text || !['bullet', 'text'].includes(b.type)) continue
    const raw = stripCite(b.text), label = (/^([^：]{1,16})：/.exec(raw)?.[1] || '').replace(/の(交換部品|品番|部品)$/, '')
    const text = raw.replace(/^[^：]*：/, '')
    // 「Vベルト：SB-37（LK161-62210）」「バッテリの交換部品：…」のように行の見出しが部品の種類なら名前に添える（「主な消耗部品：」のような総称は添えない）。
    const prefix = label && !/消耗部品|付属部品|一覧|部品$/.test(label) ? label.replace(/[（）()]/g, ' ').replace(/\s+/g, ' ').trim() : ''
    let last = ''
    for (const seg of text.split(/[、／]/)) {
      const m = seg.match(PART_NUMBER); if (!m || /取扱説明書|要領書/.test(seg)) continue
      const pn = m[0]; if (seen.has(pn)) continue; seen.add(pn)
      // 名前の前の「取扱説明書 ／ 製品ページ」（照合の行）は出どころであって部品名ではない。
      const own = seg.slice(0, seg.indexOf(pn)).replace(/[（(]\s*$/, '').replace(/[（）()]/g, ' ').replace(/取扱説明書|製品ページ|記載なし/g, ' ').replace(/\s+/g, ' ').trim()
      // 「Vベルト SA-46（…）／SB-49（…）」の SB-49 のような裸の型番は、直前の名前の種類（Vベルト）を引き継ぐ。
      const bare = /^[A-Z]{1,2}-?\d{2,3}$/.test(own) && last ? `${last.split(' ')[0]} ${own}` : own
      const name = bare ? (prefix && !bare.includes(prefix.slice(-3)) ? `${prefix} ${bare}` : bare) : last || prefix || '部品'
      const note = seg.slice(seg.indexOf(pn) + pn.length).replace(/[（）()]/g, ' ').replace(/\s*→.*$/, '').replace(/^[。、\s]+/, '').split('。')[0].replace(/\s+/g, ' ').trim().slice(0, 30)
      last = name
      rows.push({ name: name.slice(0, 40), partNumber: pn, note, blockId: b.id, source: b.text })
    }
  }
  return rows
}
// 消耗部品の行（「主な消耗部品」「消耗部品（エンジン）」など）。部品の表の下に、品番のない消耗部品も並べる。
export const consumableBlocks = blocks => (blocks || []).filter(b => b?.type === 'bullet' && /消耗部品/.test(String(b.text || '')))
// 表示用の節。kind：lead／diagnosis／schedule／parts／specs／list。parts は本文全体の品番から作る仮想の節（id: sec-parts）。
export function catalogSections(blocks) {
  const raw = []
  for (const b of blocks || []) {
    if (b?.type === 'h2' && String(b.text || '').trim()) raw.push({ heading: b, blocks: [] })
    else { if (!raw.length) raw.push({ heading: null, blocks: [] }); raw[raw.length - 1].blocks.push(b) }
  }
  const out = raw.filter(s => s.heading || s.blocks.some(b => b?.text)).map(s => {
    if (!s.heading) return { id: 'sec-lead', title: '', kind: 'lead', heading: null, blocks: s.blocks }
    const title = s.heading.text.trim(), id = sectionId(s.heading)
    if (title.startsWith('症状から探す')) return { id, title: '症状から診断する', kind: 'diagnosis', heading: s.heading, blocks: s.blocks, groups: groupSection(s.blocks).filter(g => g.head) }
    if (title.startsWith('整備と点検')) {
      const table = s.blocks.find(b => b.type === 'bullet' && /^[^：]*点検[^：]*一覧表：/.test(b.text))
      const oil = s.blocks.find(b => b.type === 'bullet' && /^給油一覧表/.test(b.text))
      return { id, title: '整備の周期', kind: 'schedule', heading: s.heading, blocks: s.blocks, rows: table ? scheduleRows(table.text) : [], table, oil, rest: s.blocks.filter(b => b !== table && b !== oil && b.type !== 'text' && b.text) }
    }
    if (SPEC_TITLES.some(t => title.startsWith(t))) return { id, title, kind: 'specs', heading: s.heading, blocks: s.blocks, rows: s.blocks.filter(b => b.type === 'bullet').map(b => ({ block: b, ...(specRow(b.text) || { label: '', value: stripCite(b.text) }) })), intro: s.blocks.find(b => b.type === 'text') }
    return { id, title, kind: 'list', heading: s.heading, blocks: s.blocks }
  })
  // 部品と費用は品番が1つもなくても置く（消耗部品の行と、修理記録の費用が入る）。
  if (out.some(s => s.heading)) out.push({ id: 'sec-parts', title: '部品と費用', kind: 'parts', heading: null, blocks: [], rows: partRows(blocks), consumables: consumableBlocks(blocks) })
  return out.sort((a, b) => (a.kind === 'lead' ? -1 : b.kind === 'lead' ? 1 : rank(a) - rank(b)))
}
export const catalogNav = blocks => catalogSections(blocks).filter(s => s.kind !== 'lead').map(s => ({ id: s.id, title: s.title }))
// 型式が同じ修理記録か（機械の型式を正規化し、ハイフンの有無を問わず比べる）。
const modelKey = s => normalize(s).replace(/[-‐‑–—\s]/g, '')
export const sameModel = (model, other) => { const a = modelKey(model), b = modelKey(other); return !!a && !!b && (a === b || b.startsWith(a) || a.startsWith(b)) }
export const repairRecordsFor = (model, records) => (records || []).filter(r => r?.meta?.subject === 'machine_repair' && sameModel(model, r.meta?.repair?.machine?.model))
// 修理記録の「行ったこと」から、費用の付いた行を集める（部品の表に「記録された費用」として載せる）。
export function recordedCosts(records) {
  const out = []
  for (const r of records || []) {
    for (const a of r?.meta?.repair?.actions || []) {
      const cost = Number(String(a.cost ?? '').replace(/[,，円]/g, ''))
      if (!Number.isFinite(cost) || cost <= 0) continue
      out.push({ recordId: r.id, title: r.title, date: a.date || r.date, what: a.what || '', parts: a.parts || '', cost })
    }
  }
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)))
}
export const costsForPart = (costs, row) => costs.filter(c => c.parts && (normalize(c.parts).includes(normalize(row.partNumber)) || (row.name.length >= 3 && normalize(c.parts).includes(normalize(row.name)))))
