// 製品ページを確認した段階のカタログ。取説の本文を読んだ解説（v1）と区別する。
import { createHash } from 'node:crypto'
import { emptyMeta } from '../src/domain.js'

export const catalogId = (maker, series) => {
  const h = createHash('sha256').update(`nitoron-catalog:${maker}:${series}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

export function validateOverview(entry, photo) {
  const fail = message => { throw new Error(`${entry.series || 'catalog'}: ${message}`) }
  if (entry.schema !== 'nitoron-catalog/2' || entry.coverage !== 'product-overview') fail('製品概要の形式が必要です')
  for (const key of ['maker', 'series', 'productName', 'category', 'summary', 'checkedAt', 'photoModel']) if (!entry[key]?.trim()) fail(`${key} がありません`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.checkedAt)) fail('確認日の形式が違います')
  if (entry.identifierKind && !['model', 'part-number'].includes(entry.identifierKind)) fail('型式・品番の区分が不正です')
  if (entry.modelPolicy === 'project-specific') {
    if (!Array.isArray(entry.models) || entry.models.length || !entry.configurationNote?.trim()) fail('施設は型式を作らず、構成を記載します')
  } else {
    if (entry.modelPolicy || !entry.models?.length || entry.models.some(model => !model.trim()) || new Set(entry.models).size !== entry.models.length) fail('型式が空または重複しています')
  }
  const official = url => { try { const u = new URL(url); return u.protocol === 'https:' && u.hostname === 'agriculture.kubota.co.jp' } catch { return false } }
  const product = entry.sources?.product
  const cropGuide = (() => {
    if (product?.kind !== 'kubota-crop-guide' || !official(product.url) || !product.title?.trim()) return false
    const u = new URL(product.url), post = u.searchParams.get('post_id')
    return /^\/special\/yasai_guide\/cat_system\/[a-z0-9_]+\/$/.test(u.pathname) && /^post\d+$/.test(post || '') && u.hash === `#${post}`
  })()
  if (product?.kind ? !cropGuide : (!official(product?.url) || !new URL(product.url).pathname.startsWith('/product/'))) fail('公式製品ページまたは製品を特定した公式栽培ガイドが必要です')
  const notListed = ref => ref?.availability === 'not-listed' && !ref.url && ref.checkedAt === entry.checkedAt
  if (!official(entry.sources?.catalog?.url) && !notListed(entry.sources?.catalog)) fail('公式カタログの参照先または未掲載の確認が必要です')
  if (!official(entry.sources?.manualIndex?.url) && !((entry.modelPolicy === 'project-specific' || cropGuide) && notListed(entry.sources?.manualIndex))) fail('取扱説明書の参照先が必要です')
  if (entry.sources.manufacturer) {
    const ref = entry.sources.manufacturer
    let valid = false
    try { const u = new URL(ref.url); valid = entry.maker === 'マツモト' && u.protocol === 'https:' && u.hostname === 'kkmatsumoto.co.jp' && u.pathname.startsWith('/products/') } catch {}
    if (!valid || !ref.title?.trim()) fail('製造元の製品参照先が不正です')
  }
  for (const manual of entry.sources.manuals || []) if (!manual.title || !official(manual.url) || !/[?&]hash=[a-f0-9]{32}$/.test(manual.url)) fail('取扱説明書の型式またはURLが不正です')
  if (!entry.facts?.length || entry.facts.some(f => !f.label || !f.value || f.source !== 'product')) fail('各項目に製品ページの根拠が必要です')
  if (entry.symptoms?.length || entry.machineRef) fail('製品概要には未確認の修理案内・3Dを付けません')
  if (!photo || photo.id !== catalogId(entry.maker, entry.series) || !official(photo.url) || photo.source?.url !== entry.sources.product.url) fail('型式と出典が対応する写真が必要です')
}

export function buildOverview(entry, photo) {
  validateOverview(entry, photo)
  const id = catalogId(entry.maker, entry.series)
  let n = 0
  const block = (type, text) => ({ id: `${id.slice(0, 8)}-${String(++n).padStart(3, '0')}`, type, text })
  const blocks = [block('h2', '製品の概要'), block('text', entry.summary),
    ...entry.facts.map(f => block('bullet', `${f.label}：${f.value}`)),
    block('h2', entry.modelPolicy === 'project-specific' ? '施設の構成' : entry.identifierKind === 'part-number' ? '品番' : '対象の型式'),
    block('text', entry.modelPolicy === 'project-specific' ? entry.configurationNote : entry.models.join(' / ')),
    block('h2', '写真について'), block('text', `掲載写真：${entry.photoModel}。${entry.modelPolicy === 'project-specific' ? '施設の構成は計画によって異なります。' : '装備は型式・仕様によって異なります。'}`),
  ]
  const source = (key, title, url) => ({ id: `${id.slice(0, 8)}-src-${key}`, title, url, date: entry.checkedAt })
  const meta = { ...emptyMeta('trouble'), inputMode: 'free',
    author: `${entry.maker}カタログ解説（Nitoron運営・非公式）`, club: 'Nitoron / 4H Club', crop: entry.category,
    summary: entry.summary, coverUrl: photo.url,
    sources: [
      source('product', entry.sources.product.title || `${entry.maker} 製品ページ ${entry.series}`, entry.sources.product.url),
      ...(entry.sources.manufacturer ? [source('manufacturer', entry.sources.manufacturer.title, entry.sources.manufacturer.url)] : []),
      ...(entry.sources.catalog.url ? [source('catalog', `${entry.maker} 製品カタログ ${entry.productName}`, entry.sources.catalog.url)] : []),
      ...(entry.sources.manualIndex.url ? [source('manual-index', entry.sources.manualIndex.title, entry.sources.manualIndex.url)] : []),
      ...((entry.sources.manuals || []).length <= 4 ? (entry.sources.manuals || []) : []).map((m, i) => source(`manual-${i + 1}`, `取扱説明書 ${m.title}`, m.url)),
      photo.source,
    ] }
  return { id, title: `【カタログ解説】${entry.maker} ${entry.series} ${entry.productName}（${entry.category}）`,
    category: entry.category, type: 'メモ', date: entry.checkedAt, blocks, meta }
}
