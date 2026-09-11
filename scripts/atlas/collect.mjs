// 資料収集：メーカーのルートから機種トークンを含むリンクを辿り、仕様・取説候補を集める。
// 見出しだけで採用せず、本文に対象型式が含まれるページだけを資料に数える。
// PDFは取得しただけでは資料に数えない：本文テキストを抽出し、対象型式を含む場合のみ採用する。
import { normalizeModelText } from './registry.mjs'
import { extractPdfText } from './pdftext.mjs'

const links = (html, base) => [...String(html).matchAll(/href="([^"#]+)"/gi)]
  .map(m => {
    try {
      // fixture:// は非特殊スキームで相対解決が効かないため、http相当で解決してから戻す
      if (base.startsWith('fixture://')) return 'fixture://' + new URL(m[1], 'http://f.local/' + base.slice('fixture://'.length)).pathname.replace(/^\//, '')
      return new URL(m[1], base).href
    } catch { return null }
  }).filter(Boolean)

// 型式トークンの照合はハイフン・空白の表記差（TK-100／TK100）を吸収する。仕様記号は落とさない。
const compact = value => normalizeModelText(value).replace(/[\s-]+/g, '')

export async function collectMaterials(fetcher, { roots, modelToken, original, maxDepth = 3 }) {
  const materials = [], visited = new Set()
  // 優先度つき探索：0=型式トークンを含む、1=取説の実体へ向かうリンク（notice/download等）、2=一般の製品・取説系。
  // ナビリンクで探索が発散して予算内に実資料へ着かないことを防ぐ。
  const queue = roots.map(url => ({ url, depth: 0, priority: 0 }))
  const token = compact(modelToken)
  const nextItem = () => {
    let best = -1
    for (let i = 0; i < queue.length; i++) if (best < 0 || queue[i].priority < queue[best].priority) best = i
    return best < 0 ? null : queue.splice(best, 1)[0]
  }
  for (let item = nextItem(); item; item = nextItem()) {
    const { url, depth, priority } = item
    if (visited.has(url)) continue
    // 対象型式のPDF資料を得た後は、一般語だけのリンク（優先度2）を追わない
    if (priority >= 2 && materials.some(m => m.pdf)) continue
    visited.add(url)
    const page = await fetcher.fetchText(url, { targetModel: original })
    if (page.status !== 'ok') continue
    if (page.pdf) {
      // PDF：本文抽出に成功し、本文に対象型式があるものだけを資料に数える
      const extracted = extractPdfText(Buffer.isBuffer(page.body) ? page.body : Buffer.from(page.body, 'latin1'))
      if (extracted.error) { page.pdfText = null; page.pdfTextError = extracted.error; continue }
      page.pdfText = extracted.pages
      if (extracted.pages.some(text => compact(text).includes(token))) materials.push(page)
      continue
    }
    if (compact(page.body).includes(token)) materials.push(page)
    if (depth >= maxDepth) continue
    for (const next of links(page.body, url)) {
      const sameHost = fetcher.kind === 'fixture' || (() => { try { return new URL(next).hostname === new URL(url).hostname } catch { return false } })()
      if (!sameHost) continue
      const label = compact(decodeURIComponent(next))
      const nextPriority = label.includes(token) ? 0
        : /notice|download|hash=|\.pdf/.test(decodeURIComponent(next).toLowerCase()) ? 1
        : /lineup|spec|manual|ownersmanual|parts|products?|cultivator|catalog|shiyou|torisetsu/.test(label) ? 2 : -1
      if (nextPriority >= 0) queue.push({ url: next, depth: depth + 1, priority: nextPriority })
    }
  }
  const failures = fetcher.provenance.filter(p => p.status !== 'ok')
  // 取得はできたが本文を抽出できず根拠に使えないPDF（未対応を対応済みとしない記録）
  const unusablePdfs = fetcher.provenance.filter(p => p.status === 'ok' && p.pdf && p.pdfTextError)
    .map(p => ({ url: p.url, sha256: p.sha256, reason: p.pdfTextError }))
  return { materials, failures, unusablePdfs, attempted: fetcher.provenance.length }
}
