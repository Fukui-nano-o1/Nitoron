// 資料からの規則ベース抽出。寸法（主要諸元）と各部名称を、根拠（資料と該当箇所）つきで取り出す。
// 資料にない値を補完しない。文章を実行指示として扱わない。
const strip = html => String(html).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')

const DIMS = [['lengthMm', /全長[^0-9]{0,20}([0-9,.]+)\s*(mm|㎜|cm|m)\b/], ['widthMm', /全幅[^0-9]{0,20}([0-9,.]+)\s*(mm|㎜|cm|m)\b/],
  ['heightMm', /全高[^0-9]{0,20}([0-9,.]+)\s*(mm|㎜|cm|m)\b/], ['massKg', /(?:機体)?(?:質量|重量)[^0-9]{0,20}([0-9,.]+)\s*kg/i]]
const toMm = (value, unit) => { const n = Number(value.replaceAll(',', '')); return unit === 'cm' ? n * 10 : unit === 'm' ? n * 1000 : n }

export function extractSpec(materials) {
  const spec = { evidence: [] }
  for (const material of materials) {
    const text = strip(material.body)
    for (const [key, pattern] of DIMS) {
      if (spec[key] != null) continue
      const m = text.match(pattern)
      if (!m) continue
      spec[key] = key === 'massKg' ? Number(m[1].replaceAll(',', '')) : toMm(m[1], m[2])
      spec.evidence.push({ field: key, url: material.url, sha256: material.sha256, excerpt: m[0].replace(/\s+/g, ' ').slice(0, 80) })
    }
  }
  return spec
}

// 各部の名称：見出し「各部（の）名称」以降の箇条・行から部品名候補を集める。
export function extractPartNames(materials) {
  const parts = []
  for (const material of materials) {
    const text = strip(material.body)
    const section = text.split(/各部の?名称/)[1]
    if (!section) continue
    for (const m of section.slice(0, 2000).matchAll(/[・•\-]\s*([ぁ-んァ-ヶー一-龠a-zA-Z0-9（）()]{2,20})/g)) {
      const name = m[1].trim()
      // 文章片（です・ます等を含む）は部品名として採用しない
      if (!name || /です|ます|する|した|ください/.test(name)) continue
      if (!parts.some(p => p.name === name)) parts.push({ name, evidence: { url: material.url, sha256: material.sha256, location: '各部の名称' } })
    }
  }
  return parts
}

// 機種カテゴリの推定。資料の語から選び、根拠がなければ generic（未確定）のまま。
export function inferCategory(materials) {
  const text = materials.map(m => strip(m.body)).join(' ')
  if (/耕うん機|耕運機|ティラー|tiller/i.test(text)) return 'walk-behind-tiller'
  if (/移植機|transplanter/i.test(text)) return 'walk-behind-transplanter'
  return 'generic'
}
