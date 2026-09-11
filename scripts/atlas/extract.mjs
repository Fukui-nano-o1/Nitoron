// 資料からの規則ベース抽出。寸法（主要諸元）と各部名称を、根拠（資料と該当箇所）つきで取り出す。
// 資料にない値を補完しない。文章を実行指示として扱わない。
const strip = html => String(html).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')

// 資料→検索対象テキスト列。HTMLはタグ除去1件、PDFは抽出済み本文をページ単位（該当箇所の記録用）。
// 本文未抽出のPDFは対象にしない（取得しただけの資料を根拠として扱わない）。
const documentsOf = material => material.pdf
  ? (material.pdfText || []).map((text, i) => ({ text, location: `PDF ${i + 1}ページ` }))
  : [{ text: strip(material.body), location: null }]

// 見出しは表組みで分かち書きされることがある（例「全　　長」）。値の後に単位が付く形式と、
// 見出し側に単位が付き値が後置される形式（例「全 長（mm）2200」）の両方を扱う。
const dimPatterns = head => [
  new RegExp(`${head}[^0-9]{0,30}?([0-9,.]+)\\s*(mm|㎜|cm|m)\\b`),                       // 値のあとに単位
  new RegExp(`${head}[^0-9]{0,30}?[（(]\\s*(mm|㎜|cm|m)\\s*[）)]\\s*([0-9,.]+)`, ''),   // 見出し側に単位
]
const DIMS = [['lengthMm', '全\\s*長'], ['widthMm', '全\\s*幅'], ['heightMm', '全\\s*高']]
const MASS = ['(?:機\\s*体\\s*)?(?:質\\s*量|重\\s*量)',
  head => [new RegExp(`${head}[^0-9]{0,30}?([0-9,.]+)\\s*kg`, 'i'), new RegExp(`${head}[^0-9]{0,30}?[（(]\\s*kg\\s*[）)]\\s*([0-9,.]+)`, 'i')]]
// 結合形式「全長×全幅×全高（mm） 1,470×550×1,130」等。単位は見出し側・数値側のどちらでもよいが、
// どちらにも無ければ採用しない（単位を勝手に補完しない）。
const COMBINED = /(?:全長\s*[×x]\s*全幅\s*[×x]\s*全高|機体寸法)\s*(?:[（(]\s*(mm|㎜|cm|m)\s*[）)])?[^0-9]{0,25}([0-9,.]+)\s*[×x]\s*([0-9,.]+)\s*[×x]\s*([0-9,.]+)\s*(mm|㎜|cm|m)?\b/
const toMm = (value, unit) => { const n = Number(String(value).replaceAll(',', '')); return unit === 'cm' ? n * 10 : unit === 'm' ? n * 1000 : n }

const compactText = value => String(value).normalize('NFKC').toLowerCase().replace(/[\s\-・･]+/g, '')

// 同じ資料面に併記された別型式（例：SKP-101とSKP-101W）。値の取り違え検査のため記録する。
// 区切り（空白・ハイフン）を保持したまま型式らしき語を切り出し、正規化して対象型式と比べる。
const otherModelTokens = (text, token) => {
  const prefix = token.match(/^[a-z]{2,}/)?.[0]
  if (!prefix) return []
  const seen = new Set()
  const normalized = String(text).normalize('NFKC').toLowerCase()
  for (const m of normalized.matchAll(new RegExp(`${prefix}[-\\s]?[0-9]+[a-z0-9]*`, 'g'))) {
    const candidate = compactText(m[0])
    if (candidate !== token) seen.add(candidate)
  }
  return [...seen]
}

export function extractSpec(materials, { modelToken = '' } = {}) {
  const spec = { evidence: [] }
  const token = compactText(modelToken)
  for (const material of materials) {
    for (const doc of documentsOf(material)) {
      // PDFは複数型式の諸元が併記されることがある：対象型式を含む面の値だけを使い、併記型式も記録する
      if (material.pdf && token && !compactText(doc.text).includes(token)) continue
      const ambiguousModels = material.pdf && token ? otherModelTokens(doc.text, token) : []
      const evidenceBase = m => ({ url: material.url, sha256: material.sha256, location: doc.location, excerpt: m.replace(/\s+/g, ' ').slice(0, 80), ...(ambiguousModels.length ? { ambiguousModels } : {}) })
      const text = doc.text
      const combined = text.match(COMBINED)
      if (combined && spec.lengthMm == null) {
        const unit = combined[1] || combined[5]
        if (unit) {
          const [L, W, H] = [combined[2], combined[3], combined[4]].map(v => toMm(v, unit === '㎜' ? 'mm' : unit))
          Object.assign(spec, { lengthMm: L, widthMm: W, heightMm: H })
          for (const field of ['lengthMm', 'widthMm', 'heightMm']) spec.evidence.push({ field, ...evidenceBase(combined[0]) })
        }
      }
      for (const [key, head] of DIMS) {
        if (spec[key] != null) continue
        const [afterUnit, headUnit] = dimPatterns(head)
        const a = text.match(afterUnit)
        const b = a ? null : text.match(headUnit)
        if (!a && !b) continue
        const [value, unit] = a ? [a[1], a[2]] : [b[2], b[1]]
        spec[key] = toMm(value, unit === '㎜' ? 'mm' : unit)
        spec.evidence.push({ field: key, ...evidenceBase((a || b)[0]) })
      }
      if (spec.massKg == null) {
        const [headPattern, make] = MASS
        const m = text.match(make(headPattern)[0]) || text.match(make(headPattern)[1])
        if (m) {
          spec.massKg = Number(m[1].replaceAll(',', ''))
          spec.evidence.push({ field: 'massKg', ...evidenceBase(m[0]) })
        }
      }
    }
  }
  return spec
}

// 各部の名称：見出し「各部（の）名称」以降の箇条・行から部品名候補を集める。
export function extractPartNames(materials) {
  const parts = []
  for (const material of materials) {
    for (const doc of documentsOf(material)) {
      const section = doc.text.split(/各部の?名称/)[1]
      if (!section) continue
      const window = section.slice(0, 2000)
      // 箇条書き（HTML）と、PDFの行区切り（1行1ラベルの図注釈）を部品名候補として集める
      const found = [...window.matchAll(/[・•\-]\s*([ぁ-んァ-ヶー一-龠a-zA-Z0-9（）()]{2,20})/g)].map(m => m[1])
      if (material.pdf) for (const line of window.split('\n')) {
        const name = line.trim()
        if (/^[ぁ-んァ-ヶー一-龠a-zA-Z0-9（）()・]{2,20}$/.test(name)) found.push(name.replace(/^・/, ''))
      }
      for (const raw of found) {
        const name = raw.trim()
        // 文章片（です・ます等を含む）や、数字・記号だけの断片（型式番号の一部等）は部品名として採用しない
        if (!name || /です|ます|する|した|ください/.test(name)) continue
        if (!/[ぁ-んァ-ヶー一-龠a-zA-Z]/.test(name)) continue
        if (!parts.some(p => p.name === name)) parts.push({ name, evidence: { url: material.url, sha256: material.sha256, location: doc.location ? `各部の名称（${doc.location}）` : '各部の名称' } })
      }
    }
  }
  return parts
}

// 機種カテゴリの推定。資料の語から選び、根拠がなければ generic（未確定）のまま。
export function inferCategory(materials) {
  const text = materials.flatMap(m => documentsOf(m).map(d => d.text)).join(' ')
  if (/耕うん機|耕運機|ティラー|tiller/i.test(text)) return 'walk-behind-tiller'
  if (/移植機|transplanter/i.test(text)) return 'walk-behind-transplanter'
  return 'generic'
}
