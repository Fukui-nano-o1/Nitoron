// PDF本文のテキスト抽出（依存追加なし・node:zlibのみ）。
// 対応範囲：FlateDecode、オブジェクトストリーム（ObjStm）、ToUnicode CMapによる文字復元。
// 暗号化PDF・画像のみのページ・未対応フィルタは「抽出不可」を明示して返す（推測で補完しない）。
import { inflateSync } from 'node:zlib'
import { createDecryptor } from './pdfcrypt.mjs'

const latin1 = buffer => buffer.toString('latin1')

// 「<< ... >>」の対応を取って辞書文字列を切り出す
const balancedDict = (text, start) => {
  let depth = 0
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === '<' && text[i + 1] === '<') { depth++; i++ }
    else if (text[i] === '>' && text[i + 1] === '>') { depth--; i++; if (depth === 0) return text.slice(start, i + 1) }
  }
  return null
}

const refIn = (dict, key) => dict?.match(new RegExp(`\\/${key}\\s+(\\d+)\\s+\\d+\\s+R`))?.[1]
const dictIn = (dict, key) => {
  const at = dict?.search(new RegExp(`\\/${key}\\s*<<`))
  if (at == null || at < 0) return null
  return balancedDict(dict, dict.indexOf('<<', at))
}

// ファイル全体からオブジェクト表（辞書文字列＋ストリーム位置）をつくる
function indexObjects(buffer) {
  const text = latin1(buffer)
  const objects = new Map()
  for (const m of text.matchAll(/(\d+)\s+(\d+)\s+obj\b/g)) {
    const bodyStart = m.index + m[0].length
    const end = text.indexOf('endobj', bodyStart)
    if (end < 0) continue
    let body = text.slice(bodyStart, end)
    let stream = null
    const streamAt = body.indexOf('stream')
    if (streamAt >= 0) {
      const dataStart = bodyStart + streamAt + 'stream'.length + (body[streamAt + 6] === '\r' ? 2 : 1)
      const dataEnd = text.indexOf('endstream', dataStart)
      if (dataEnd >= 0) stream = buffer.subarray(dataStart, dataEnd)
      body = body.slice(0, streamAt)
    }
    if (!objects.has(Number(m[1]))) objects.set(Number(m[1]), { num: Number(m[1]), gen: Number(m[2]), dict: body, stream })
  }
  return { text, objects }
}

// /Length（直接値・間接参照の両対応）でストリームの正確なバイト数を得る
const streamLength = (obj, objects) => {
  const direct = obj.dict.match(/\/Length\s+(\d+)(?![\s]+\d+\s+R)/)
  if (direct) return Number(direct[1])
  const ref = obj.dict.match(/\/Length\s+(\d+)\s+\d+\s+R/)
  const resolved = ref && objects?.get(Number(ref[1]))?.dict.match(/\d+/)
  return resolved ? Number(resolved[0]) : null
}

// ストリームの実データ化：暗号化されていれば先に復号（XRefストリームは仕様上非暗号）
const decodeStream = (obj, crypt, objects) => {
  if (!obj?.stream) return null
  try {
    let raw = obj.stream
    // スキャンで切り出した範囲はendstream直前の改行を含みうるため、/Lengthで正確に切る
    const length = streamLength(obj, objects)
    if (length != null && length <= raw.length) raw = raw.subarray(0, length)
    else if (crypt) { let end = raw.length; while (end > 0 && (raw[end - 1] === 10 || raw[end - 1] === 13)) end--; raw = raw.subarray(0, end) }
    if (crypt && !/\/Type\s*\/XRef\b/.test(obj.dict)) {
      raw = crypt.decryptStream(Buffer.from(raw), obj.num, obj.gen)
      if (!raw) return null
    }
    if (/\/FlateDecode/.test(obj.dict)) return inflateSync(raw)
    if (!/\/Filter/.test(obj.dict)) return Buffer.from(raw)
    return null // LZW・DCT等は未対応（未対応を対応済みとしない）
  } catch { return null }
}

// Encrypt辞書やO/U/OE/UE等のPDF文字列（リテラル・16進の両形式）を辞書テキストから取り出す
function pdfStringValue(dict, key) {
  const m = dict?.match(new RegExp(`\\/${key}(?![A-Za-z0-9])\\s*`))
  if (!m) return null
  const at = m.index + m[0].length
  if (dict[at] === '(') return Buffer.from(literalBytes(dict, at + 1).bytes)
  if (dict[at] === '<') {
    const hex = dict.slice(at + 1, dict.indexOf('>', at)).replace(/\s+/g, '')
    return Buffer.from(hex, 'hex')
  }
  return null
}

// 暗号化文書の復号器を用意する。空パスワードで開けない場合等は error を返す。
function setupDecryption(text, objects) {
  const ref = text.match(/\/Encrypt\s+(\d+)\s+\d+\s+R/)
  if (!ref) return { crypt: null }
  const dict = objects.get(Number(ref[1]))?.dict
  if (!dict || !/\/Filter\s*\/Standard\b/.test(dict)) return { error: 'unsupported-encryption' }
  const idHex = text.match(/\/ID\s*\[\s*<([0-9a-fA-F]+)>/)
  const num = key => { const m = dict.match(new RegExp(`\\/${key}(?![A-Za-z0-9])\\s+(-?\\d+)`)); return m ? Number(m[1]) : undefined }
  const result = createDecryptor({
    V: num('V') ?? 0, R: num('R') ?? 0, P: num('P') ?? -1, length: num('Length'),
    O: pdfStringValue(dict, 'O'), U: pdfStringValue(dict, 'U'), UE: pdfStringValue(dict, 'UE'),
    id: idHex ? Buffer.from(idHex[1], 'hex') : Buffer.alloc(0),
    cfm: dict.match(/\/CFM\s*\/(\w+)/)?.[1], encryptMetadata: !/\/EncryptMetadata\s+false/.test(dict),
  })
  if (result.error) return { error: result.error }
  return { crypt: result }
}

// オブジェクトストリーム（/Type /ObjStm）内の辞書を表へ追加する
function expandObjectStreams(objects, crypt) {
  for (const obj of [...objects.values()]) {
    if (!/\/Type\s*\/ObjStm\b/.test(obj.dict)) continue
    const data = decodeStream(obj, crypt, objects)
    if (!data) continue
    const n = Number(obj.dict.match(/\/N\s+(\d+)/)?.[1] || 0)
    const first = Number(obj.dict.match(/\/First\s+(\d+)/)?.[1] || 0)
    const text = latin1(data)
    const header = text.slice(0, first).trim().split(/\s+/).map(Number)
    for (let i = 0; i < n; i++) {
      const [num, offset] = [header[i * 2], header[i * 2 + 1]]
      const next = i + 1 < n ? header[i * 2 + 3] : text.length - first
      if (Number.isFinite(num) && !objects.has(num)) objects.set(num, { dict: text.slice(first + offset, first + next), stream: null })
    }
  }
}

// ToUnicode CMap（bfchar/bfrange）→ コード→文字列 の対応表
function parseToUnicode(cmapText) {
  const map = new Map()
  let codeBytes = 1
  const hexToStr = hex => {
    const clean = hex.replace(/\s+/g, '')
    let out = ''
    for (let i = 0; i + 4 <= clean.length; i += 4) out += String.fromCharCode(parseInt(clean.slice(i, i + 4), 16))
    // UTF-16サロゲートペアの復元
    return out.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, s => s)
  }
  for (const range of cmapText.matchAll(/begincodespacerange([\s\S]*?)endcodespacerange/g)) {
    const lo = range[1].match(/<([0-9a-fA-F]+)>/)
    if (lo) codeBytes = Math.max(codeBytes, Math.ceil(lo[1].length / 2))
  }
  for (const block of cmapText.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F\s]+)>/g)) {
      codeBytes = Math.max(codeBytes, Math.ceil(m[1].length / 2))
      map.set(parseInt(m[1], 16), hexToStr(m[2]))
    }
  }
  for (const block of cmapText.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F\s]+>|\[[\s\S]*?\])/g)) {
      codeBytes = Math.max(codeBytes, Math.ceil(m[1].length / 2))
      const [lo, hi] = [parseInt(m[1], 16), parseInt(m[2], 16)]
      if (hi - lo > 65535) continue
      if (m[3][0] === '[') {
        const items = [...m[3].matchAll(/<([0-9a-fA-F\s]+)>/g)]
        for (let c = lo; c <= hi && c - lo < items.length; c++) map.set(c, hexToStr(items[c - lo][1]))
      } else {
        const base = m[3].slice(1, -1).replace(/\s+/g, '')
        const prefix = base.slice(0, -4)
        const start = parseInt(base.slice(-4), 16)
        for (let c = lo; c <= hi; c++) map.set(c, hexToStr(prefix) + String.fromCharCode(start + (c - lo)))
      }
    }
  }
  return { map, codeBytes }
}

// コンテンツストリーム中のPDF文字列リテラル→バイト列
function literalBytes(text, start) {
  const bytes = []
  let depth = 1
  let i = start
  while (i < text.length && depth > 0) {
    const ch = text[i]
    if (ch === '\\') {
      const next = text[i + 1]
      const oct = text.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)
      if (oct) { bytes.push(parseInt(oct[0], 8) & 0xff); i += 1 + oct[0].length; continue }
      const escaped = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 }[next]
      if (escaped != null) bytes.push(escaped)
      i += 2; continue
    }
    if (ch === '(') depth++
    else if (ch === ')') { depth--; if (depth === 0) { i++; break } }
    if (depth > 0 && ch !== '(' ) bytes.push(ch.charCodeAt(0) & 0xff)
    else if (depth > 1 && ch === '(') bytes.push(40)
    i++
  }
  return { bytes, end: i }
}

const decodeBytes = (bytes, font) => {
  if (font?.map) {
    let out = ''
    const step = font.codeBytes
    for (let i = 0; i + step <= bytes.length; i += step) {
      let code = 0
      for (let k = 0; k < step; k++) code = (code << 8) | bytes[i + k]
      const mapped = font.map.get(code)
      if (mapped != null) out += mapped
    }
    return out
  }
  // ToUnicodeがない単純フォント：ASCII可読域のみ採用（他は推測しない）
  return bytes.map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '')).join('')
}

// 1ページ分のコンテンツストリームからテキストを組み立てる
function pageText(content, fonts) {
  let out = ''
  let font = null
  let pendingName = null
  const text = latin1(content)
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '%') { i = text.indexOf('\n', i); if (i < 0) break; continue }
    if (ch === '(') {
      const { bytes, end } = literalBytes(text, i + 1)
      out += decodeBytes(bytes, font)
      i = end - 1; continue
    }
    if (ch === '<' && text[i + 1] !== '<') {
      const close = text.indexOf('>', i)
      if (close < 0) break
      const hex = text.slice(i + 1, close).replace(/\s+/g, '')
      const bytes = []
      for (let k = 0; k + 2 <= hex.length; k += 2) bytes.push(parseInt(hex.slice(k, k + 2), 16))
      out += decodeBytes(bytes, font)
      i = close; continue
    }
    if (ch === '/') {
      const m = text.slice(i + 1, i + 128).match(/^[^\s/<>()[\]{}%]+/)
      pendingName = m ? m[0] : null
      if (m) i += m[0].length
      continue
    }
    if (/[A-Za-z'"*]/.test(ch)) {
      const m = text.slice(i, i + 4).match(/^(T[fjdDm*]|TJ|Tj|'|"|BT|ET|Do|gs)/)
      if (m) {
        const op = m[1]
        if (op === 'Tf' && pendingName) font = fonts.get(pendingName) || null
        if (op === 'Td' || op === 'TD' || op === 'T*' || op === 'Tm' || op === "'") out += '\n'
        i += op.length - 1
      } else { const skip = text.slice(i).match(/^[A-Za-z*]+/); if (skip) i += skip[0].length - 1 }
      continue
    }
  }
  return out.replace(/\n{3,}/g, '\n\n')
}

// 公開API：PDFバイト列 → { pages: [ページ別テキスト] } または { error }
export function extractPdfText(buffer) {
  if (!Buffer.isBuffer(buffer)) return { error: 'not-a-buffer' }
  if (latin1(buffer.subarray(0, 8)).indexOf('%PDF-') !== 0) return { error: 'not-a-pdf' }
  const { text, objects } = indexObjects(buffer)
  const { crypt, error: cryptError } = setupDecryption(text, objects)
  if (cryptError) return { error: cryptError }
  expandObjectStreams(objects, crypt)
  const fontCache = new Map()
  const fontFor = ref => {
    if (fontCache.has(ref)) return fontCache.get(ref)
    const fontObj = objects.get(Number(ref))
    const toUniRef = refIn(fontObj?.dict, 'ToUnicode')
    const cmapData = toUniRef ? decodeStream(objects.get(Number(toUniRef)), crypt, objects) : null
    const parsed = cmapData ? parseToUnicode(latin1(cmapData)) : null
    fontCache.set(ref, parsed)
    return parsed
  }
  const pages = []
  let extractedChars = 0
  for (const obj of objects.values()) {
    if (!/\/Type\s*\/Page\b/.test(obj.dict)) continue
    // ページのフォント表（資源辞書は直書き・間接参照の両対応）
    const resources = dictIn(obj.dict, 'Resources') || objects.get(Number(refIn(obj.dict, 'Resources')))?.dict || ''
    const fontDict = dictIn(resources, 'Font') || objects.get(Number(refIn(resources, 'Font')))?.dict || ''
    const fonts = new Map()
    for (const m of fontDict.matchAll(/\/([^\s/<>()[\]{}%]+)\s+(\d+)\s+\d+\s+R/g)) {
      const parsed = fontFor(m[2])
      if (parsed) fonts.set(m[1], parsed)
    }
    // コンテンツ（単独参照・配列の両対応）
    const contentRefs = obj.dict.match(/\/Contents\s*\[([^\]]*)\]/)?.[1]?.match(/(\d+)\s+\d+\s+R/g)?.map(r => r.match(/\d+/)[0])
      || (refIn(obj.dict, 'Contents') ? [refIn(obj.dict, 'Contents')] : [])
    const parts = contentRefs.map(r => decodeStream(objects.get(Number(r)), crypt, objects)).filter(Boolean)
    if (!parts.length) { pages.push(''); continue }
    const body = pageText(Buffer.concat(parts), fonts)
    extractedChars += body.length
    pages.push(body)
  }
  if (!pages.length) return { error: 'no-pages-extracted' }
  if (!extractedChars) return { error: 'no-text-extracted' }
  return { pages, pageCount: pages.length, extractedChars }
}
