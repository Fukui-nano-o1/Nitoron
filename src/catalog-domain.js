// カタログ解説（【カタログ解説】メーカー 型式 製品名（分類））の読み取りと、詳細ページの節・関連行。
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
