// 旧型機の諸元は公式検索で確認し、基本型式を照合した中古実機写真だけを添える。
import { emptyMeta } from '../src/domain.js'

const modelKey = value => String(value || '').normalize('NFKC').toUpperCase().replace(/[-‐‑–—\s]/g, '')
const official = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'agriculture.kubota.co.jp' ? url : null } catch { return null }
}

export function validateHistoricalOverview(entry, photo, expectedId) {
  const fail = message => { throw new Error(`${entry.series || 'catalog'}: ${message}`) }
  if (entry.schema !== 'nitoron-catalog/2' || entry.coverage !== 'historical-overview') fail('旧型製品の概要形式が必要です')
  if (entry.maker !== 'クボタ' || entry.category !== 'トラクタ') fail('クボタのトラクタが対象です')
  if (!/^[A-Z]+\d+[A-Z]*$/.test(entry.series || '') || entry.models?.length !== 1 || entry.models[0] !== entry.series) fail('基本型式を1件指定してください')
  if (!entry.productName?.trim() || !entry.summary?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(entry.checkedAt || '')) fail('製品名・概要・確認日が必要です')

  const manual = entry.sources?.manualIndex, sales = entry.sources?.salesIndex
  const manualUrl = official(manual?.url), salesUrl = official(sales?.url)
  if (manualUrl?.pathname !== '/after-support/manual/list.html' || manualUrl.searchParams.get('q') !== entry.series || manualUrl.searchParams.get('searchType') !== '3') fail('基本型式の完全一致による公式取説検索が必要です')
  if (salesUrl?.pathname !== '/after-support/psyss/list.html' || salesUrl.searchParams.get('q') !== entry.series || salesUrl.searchParams.get('category') !== '1') fail('基本型式の公式販売年度検索が必要です')
  for (const source of [manual, sales]) if (source.checkedAt !== entry.checkedAt || !/^[a-f0-9]{64}$/.test(source.sha256 || '')) fail('出典の確認日と取得内容のハッシュが必要です')

  if (manual.result?.model !== entry.series || manual.result?.category !== entry.category || !/^\d+(?:\.\d+)?馬力$/.test(manual.result?.horsepower || '')) fail('取説検索の型式・分類・馬力が一致しません')
  const period = sales.result
  // FT25(F)のような公式の括弧付き表記は保持し、別型式（FT25H等）とは区別する。
  if (!new RegExp(`^${entry.series}(?:\\([A-Z]+\\))?$`).test(modelKey(period?.model)) || !Number.isInteger(period?.startYear) || !Number.isInteger(period?.endYear) || period.startYear < 1900 || period.endYear < period.startYear || period.endYear >= Number(entry.checkedAt.slice(0, 4))) fail('対象型式の過去の販売期間が必要です')
  if (entry.sources.manuals?.length !== 1) fail('対象型式の取扱説明書が必要です')
  const document = entry.sources.manuals[0], notice = official(document.url)
  if (document.title !== entry.series || notice?.pathname !== '/after-support/manual/notice.html' || !/^[a-f0-9]{32}$/.test(notice.searchParams.get('hash') || '') || document.checkedAt !== entry.checkedAt) fail('対象型式と取扱説明書の案内先が一致しません')
  const belongs = model => new RegExp(`^${entry.series}(?:[^0-9]|$)`).test(modelKey(model))
  const variants = sales.variants || [], related = entry.sources.relatedManuals || []
  if (!Array.isArray(variants) || new Set(variants.map(item => modelKey(item.model))).size !== variants.length) fail('仕様別の販売年度が重複しています')
  for (const item of variants) {
    if (!belongs(item.model) || modelKey(item.model) === modelKey(period.model) || !Number.isInteger(item.startYear) || !Number.isInteger(item.endYear) || item.startYear < 1900 || item.endYear < item.startYear || item.endYear >= Number(entry.checkedAt.slice(0, 4))) fail('仕様別の型式・販売期間が不正です')
  }
  if (!Array.isArray(related) || new Set(related.map(item => item.title)).size !== related.length) fail('関連する公式資料が重複しています')
  for (const item of related) {
    const url = official(item.url)
    if (!belongs(item.title) || item.title === entry.series || !['variant', 'guide'].includes(item.kind) || url?.pathname !== '/after-support/manual/notice.html' || !/^[a-f0-9]{32}$/.test(url.searchParams.get('hash') || '') || item.checkedAt !== entry.checkedAt || !/^[a-f0-9]{64}$/.test(item.sha256 || '')) fail('関連資料の基本型式・参照先・確認記録が一致しません')
  }
  if (entry.symptoms?.length || entry.machineRef) fail('この概要には未確認の修理案内・3Dを付けません')
  if (photo || entry.photoModel) {
    const listedModels = [entry.series, period.model, ...variants.map(item => item.model), ...related.filter(item => item.kind === 'variant').map(item => item.title)]
      .flatMap(model => [modelKey(model), modelKey(model).replace(/\(([A-Z]+)\)/g, '$1'), modelKey(model).replace(/\([A-Z]+\)/g, '')])
    if (!photo || !expectedId || photo.id !== expectedId || photo.model !== entry.series || entry.photoModel !== (photo.labelModel || photo.model) || !listedModels.includes(modelKey(entry.photoModel)) || photo.kind !== 'used-machine-photo') fail('写真と公式掲載の型式が一致しません')
    let image, source
    try { image = new URL(photo.url); source = new URL(photo.source.url) } catch { fail('写真と掲載元のURLが必要です') }
    if (image.protocol !== 'https:' || source.protocol !== 'https:' || image.hostname !== source.hostname || !photo.source.title?.trim() || photo.source.date !== entry.checkedAt) fail('写真の掲載元・出典・確認日が一致しません')
  }
}

export function buildHistoricalOverview(entry, id, photo) {
  validateHistoricalOverview(entry, photo, id)
  let n = 0
  const block = (type, text) => ({ id: `${id.slice(0, 8)}-${String(++n).padStart(3, '0')}`, type, text })
  const manual = entry.sources.manualIndex, sales = entry.sources.salesIndex
  const blocks = [
    block('h2', '製品の概要'), block('text', entry.summary),
    block('bullet', `馬力：${manual.result.horsepower}（公式取扱説明書検索）`),
    block('bullet', `販売期間：${sales.result.startYear}年〜${sales.result.endYear}年（公式販売年度検索・${sales.result.model}）`),
    block('h2', '対象の型式'), block('text', entry.series),
    block('h2', '取扱説明書'), block('text', `${entry.series}の公式取扱説明書は、出典の案内ページから確認できます。`),
    block('h2', '確認した範囲'), block('text', `${entry.checkedAt}に公式検索の型式・馬力・販売期間と取扱説明書の案内先を確認。本文の整備手順・部品の適合・現在の在庫や中古価格は確認していません。`),
  ]
  if (photo) blocks.push(block('h2', '写真について'), block('text', `掲載写真：${entry.photoModel}の中古実機。装備・塗装・状態は撮影個体のもので、販売在庫や新品時の標準仕様を示すものではありません。`))
  if (sales.variants?.length) {
    blocks.push(block('h2', '仕様別の販売期間'))
    for (const item of sales.variants) blocks.push(block('bullet', `${item.model}：${item.startYear}年〜${item.endYear}年（公式販売年度検索）`))
  }
  const related = entry.sources.relatedManuals || []
  if (related.length) {
    blocks.push(block('h2', '仕様別の取扱説明書・補足資料'), block('text', '実機の型式末尾と資料名を照合してください。各資料へのリンクは「出典・資料」にあります。'))
    for (const item of related) blocks.push(block('bullet', `${item.title}（${item.kind === 'guide' ? '補足資料' : '仕様別資料'}）`))
  }
  const source = (key, title, url) => ({ id: `${id.slice(0, 8)}-src-${key}`, title, url, date: entry.checkedAt })
  return {
    id, title: `【カタログ解説】${entry.maker} ${entry.series} ${entry.productName}（${entry.category}）`,
    category: entry.category, type: 'メモ', date: entry.checkedAt, blocks,
    meta: { ...emptyMeta('trouble'), inputMode: 'free',
      author: `${entry.maker}カタログ解説（Nitoron運営・非公式）`, club: 'Nitoron / 4H Club', crop: entry.category,
      summary: entry.summary, coverUrl: photo?.url || '',
      sources: [
        source('manual-index', `クボタ 取扱説明書検索 ${entry.series}（完全一致）`, manual.url),
        source('sales-index', `クボタ 販売年度検索 ${entry.series}`, sales.url),
        source('manual', `取扱説明書 ${entry.series}`, entry.sources.manuals[0].url),
        ...(photo ? [photo.source] : []),
        ...related.map((item, index) => source(`related-${index + 1}`, `クボタ 公式資料 ${item.title}`, item.url)),
      ],
    },
  }
}
