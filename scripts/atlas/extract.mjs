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

// --- 複数型式（販売型式名の列）を持つ諸元表の列対応 ---
// 対象列との対応が確定した値だけを採用する。確定できない行は ambiguous として記録し、採用しない。
const MODEL_TOKEN = /^[A-Za-z]{1,6}[0-9][0-9A-Za-z-]*$/
const NUM_TOKEN = /^[0-9][0-9,.]*$/
const EMPTY_CELL = /^[－―—-]$/

// ヘッダ行「販売型式名 A [A'] B [B'] …」から列（主型式と[]内の派生型式）を読み取る
function parseModelColumns(tokens, from) {
  const columns = []
  for (let i = from; i < tokens.length; i++) {
    const t = tokens[i].normalize('NFKC')
    const bracket = t.match(/^\[([0-9A-Za-z-]+)\]$/)
    if (bracket && columns.length) { columns[columns.length - 1].alt = compactText(bracket[1]); continue }
    if (MODEL_TOKEN.test(t)) { columns.push({ main: compactText(t) }); continue }
    break
  }
  return columns
}

// 行の値グループ（数値＋任意の[派生値]、空欄「－」）を集める。数値以外が来たら行の終わり。
function parseValueGroups(tokens, from) {
  const groups = []
  let i = from
  for (; i < tokens.length; i++) {
    const t = tokens[i].normalize('NFKC')
    const bracket = t.match(/^\[([0-9][0-9,.]*)\]$/)
    if (bracket && groups.length) { groups[groups.length - 1].alt = Number(bracket[1].replaceAll(',', '')); continue }
    if (NUM_TOKEN.test(t)) { groups.push({ main: Number(t.replaceAll(',', '')) }); continue }
    if (EMPTY_CELL.test(t)) { groups.push({ main: null }); continue }
    break
  }
  return groups
}

// 複数型式の諸元表から、対象型式の列に対応する寸法・質量を取り出す。
// 戻り値：{ found: {field: {value, column, excerpt}}, ambiguous: [...], columns } ／ ヘッダが無ければ null。
export function extractColumnTable(text, targetToken) {
  const tokens = String(text).split(/\s+/).filter(Boolean)
  const headerAt = tokens.findIndex(t => /販売型式名|^型式名$/.test(t.normalize('NFKC')))
  if (headerAt < 0) return null
  // 見出しと型式が同一トークンに連結されている表（例「販売型式名FTR70(-L)FTR90」）は、
  // 列の切れ目を確定できないため、値を採用せず「列対応不能」として返す。
  const trailing = tokens[headerAt].normalize('NFKC').replace(/^.*販売型式名/, '')
  if (trailing && /[A-Za-z]{2,}[0-9]/.test(trailing)) {
    return { found: {}, ambiguous: [{ reason: 'columns-unresolvable-concatenated-header', header: tokens[headerAt].slice(0, 60) }], columns: [], targetColumn: -1, unresolvable: true }
  }
  const columns = parseModelColumns(tokens, headerAt + 1)
  if (columns.length < 2) return null
  const target = compactText(targetToken)
  const columnIndex = columns.findIndex(c => c.main === target || c.alt === target)
  const useAlt = columnIndex >= 0 && columns[columnIndex].alt === target
  const FIELDS = [
    ['lengthMm', /^全長/, /^[（(]?mm[）)]?$/i], ['widthMm', /^全幅/, /^[（(]?mm[）)]?$/i],
    ['heightMm', /^全高/, /^[（(]?mm[）)]?$/i], ['massKg', /^機体質量|^質量|^機体重量/, /^[（(]?kg[）)]?$/i],
  ]
  const found = {}
  const ambiguous = []
  for (const [field, head, unit] of FIELDS) {
    const rowAt = tokens.findIndex(t => head.test(t.normalize('NFKC')))
    if (rowAt < 0) continue
    // 見出しから数トークン以内の単位を必須にする（単位を勝手に補完しない）
    let unitAt = -1
    for (let i = rowAt; i < Math.min(rowAt + 10, tokens.length); i++) if (unit.test(tokens[i].normalize('NFKC'))) { unitAt = i; break }
    if (unitAt < 0) { ambiguous.push({ field, reason: 'unit-not-found' }); continue }
    const groups = parseValueGroups(tokens, unitAt + 1)
    if (groups.length === 1 && groups[0].main != null) {
      // 1値の行は全列共通
      found[field] = { value: groups[0].main, column: '全型式共通', excerpt: `${tokens[rowAt]} ${tokens[unitAt]} ${groups[0].main}` }
    } else if (groups.length === columns.length && columnIndex >= 0) {
      const g = groups[columnIndex]
      const value = useAlt ? (g.alt ?? g.main) : g.main
      if (value != null) found[field] = { value, column: (useAlt && columns[columnIndex].alt) || columns[columnIndex].main, columnIndex, excerpt: `${tokens[rowAt]} ${tokens[unitAt]} 列${columnIndex + 1}/${columns.length}=${value}` }
      else ambiguous.push({ field, reason: 'empty-cell-for-target' })
    } else {
      // 値の数が列数と一致しない：対応を確定できないため採用しない
      ambiguous.push({ field, reason: `value-count-${groups.length}-vs-columns-${columns.length}` })
    }
  }
  return { found, ambiguous, columns: columns.map(c => c.alt ? `${c.main}[${c.alt}]` : c.main), targetColumn: columnIndex }
}

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
  const spec = { evidence: [], ambiguous: [] }
  const token = compactText(modelToken)
  for (const material of materials) {
    for (const doc of documentsOf(material)) {
      // PDFは複数型式の諸元が併記されることがある：対象型式を含む面の値だけを使い、併記型式も記録する
      if (material.pdf && token && !compactText(doc.text).includes(token)) continue
      const ambiguousModels = material.pdf && token ? otherModelTokens(doc.text, token) : []
      const evidenceBase = m => ({ url: material.url, sha256: material.sha256, location: doc.location, excerpt: m.replace(/\s+/g, ' ').slice(0, 80), ...(ambiguousModels.length ? { ambiguousModels } : {}) })
      // 複数型式の列を持つ諸元表：対象列と対応が取れた値だけを採用する（先頭列の値で続行しない）
      const table = token ? extractColumnTable(doc.text, token) : null
      if (table) {
        if (table.unresolvable) {
          spec.ambiguous.push({ url: material.url, location: doc.location, ...table.ambiguous[0] })
          continue
        }
        if (table.targetColumn < 0) {
          spec.ambiguous.push({ url: material.url, location: doc.location, reason: 'target-not-in-model-columns', columns: table.columns })
          continue
        }
        for (const [field, hit] of Object.entries(table.found)) {
          if (spec[field] != null) continue
          spec[field] = hit.value
          spec.evidence.push({ field, url: material.url, sha256: material.sha256, location: doc.location, column: hit.column, columns: table.columns, excerpt: hit.excerpt.slice(0, 80) })
        }
        for (const a of table.ambiguous) spec.ambiguous.push({ ...a, url: material.url, location: doc.location })
        continue
      }
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
      // 箇条書き（・名称）と、PDF凡例の「(n) 名称」行だけを部品名候補として集める。
      // 本文の文章行を裸のまま拾うと文片が混入するため採用しない。
      const found = [...window.matchAll(/[・•\-]\s*([ぁ-んァ-ヶー一-龠a-zA-Z0-9（）()]{2,20})/g)].map(m => m[1])
      if (material.pdf) for (const line of window.split('\n')) {
        const m = line.trim().match(/^[（(]\d{1,2}[）)]\s*([ぁ-んァ-ヶー一-龠a-zA-Z0-9（）()・［］\[\]、]{2,25})$/)
        if (m) found.push(m[1])
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
  if (/耕うん機|耕運機|管理機|ティラー|tiller/i.test(text)) return 'walk-behind-tiller'
  if (/移植機|transplanter/i.test(text)) return 'walk-behind-transplanter'
  return 'generic'
}
