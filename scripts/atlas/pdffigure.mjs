// 「各部の名称」図からの部品位置取得。
// 1) 凡例（(n)→部品名）をテキストの座標から対応付ける
// 2) 図の画像（ラスタ）を復号・解凍・PNG予測子解除で取り出す
// 3) ローカルOCR（tesseract）で図中の (n) マーカーの座標を検出する
// 4) マーカーから引出線を画素追跡し、指し先（部品位置）を求める
// 位置の根拠はすべて資料由来（図中符号・引出線）。追跡できない場合はマーカー位置と明示し、推測で補完しない。
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { openPdf, listPages, pageImages, extractPdfText } from './pdftext.mjs'

// --- テキスト断片→行まとめ（凡例の (n) と名称の対応付けに使う） ---
export function runsToLines(runs) {
  const sorted = [...runs].sort((a, b) => (b.y - a.y) || (a.x - b.x))
  const lines = []
  for (const run of sorted) {
    const line = lines.find(l => Math.abs(l.y - run.y) <= 2.5)
    if (line) { line.items.push(run); line.y = (line.y + run.y) / 2 }
    else lines.push({ y: run.y, items: [run] })
  }
  for (const line of lines) line.items.sort((a, b) => a.x - b.x)
  return lines
}

// 凡例：「(n) 名称 ……… ページ数」の行から n→名称 を取り出す
export function parseLegend(runs) {
  const legend = new Map()
  for (const line of runsToLines(runs)) {
    const text = line.items.map(i => i.text).join(' ')
    for (const m of text.matchAll(/[（(]\s*(\d{1,2})\s*[）)]\s*([^（()）.．…･]{2,30}?)\s*(?:[.．…･]{2,}|$)/g)) {
      const n = Number(m[1])
      const name = m[2].trim().replace(/\s+/g, '')
      if (!name || !/[ぁ-ヶ一-龠a-zA-Z]/.test(name)) continue
      if (!legend.has(n)) legend.set(n, name)
    }
  }
  return legend
}

// 図ページの選定：見出しに「各部の名称／各装置の名称」があり、凡例が5点以上とれるページ
export function findFigurePages(pages, pageRuns) {
  const hits = []
  for (let i = 0; i < pages.length; i++) {
    if (!/各部の名称|各装置の名称/.test(pages[i])) continue
    const legend = parseLegend(pageRuns[i] || [])
    if (legend.size >= 5) hits.push({ pageIndex: i, legend })
  }
  return hits
}

// --- 画像のラスタ化（PNG予測子の解除）とPNG書き出し ---
export function unfilterImage(image) {
  const { data, width: w, height: h, colors } = image
  if (!data) return null
  const bpp = colors
  const stride = w * bpp + (image.predictor >= 10 ? 1 : 0)
  if (image.predictor < 10) return { pixels: data.subarray(0, w * h * bpp), w, h, channels: bpp }
  if (data.length < h * stride) return null
  const out = Buffer.alloc(h * w * bpp)
  for (let y = 0; y < h; y++) {
    const f = data[y * stride]
    const rowIn = data.subarray(y * stride + 1, y * stride + 1 + w * bpp)
    const row = out.subarray(y * w * bpp, (y + 1) * w * bpp)
    const prev = y > 0 ? out.subarray((y - 1) * w * bpp, y * w * bpp) : null
    for (let x = 0; x < w * bpp; x++) {
      const a = x >= bpp ? row[x - bpp] : 0
      const b = prev ? prev[x] : 0
      const c = x >= bpp && prev ? prev[x - bpp] : 0
      let pr = 0
      if (f === 1) pr = a
      else if (f === 2) pr = b
      else if (f === 3) pr = (a + b) >> 1
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      row[x] = (rowIn[x] + pr) & 255
    }
  }
  return { pixels: out, w, h, channels: bpp }
}

const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c }
  return t
})()
const crc32 = buf => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0 }
const pngChunk = (type, body) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(body.length)
  const typeBuf = Buffer.from(type, 'latin1')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, body])))
  return Buffer.concat([len, typeBuf, body, crc])
}

export function encodePng({ pixels, w, h, channels }) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = channels === 3 ? 2 : 0; // truecolor / grayscale
  const raw = Buffer.alloc(h * (w * channels + 1))
  for (let y = 0; y < h; y++) {
    raw[y * (w * channels + 1)] = 0
    pixels.copy(raw, y * (w * channels + 1) + 1, y * w * channels, (y + 1) * w * channels)
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// --- OCR（ローカルtesseract）。図中の (n) マーカーの座標を検出する ---
export function ocrAvailable() {
  return spawnSync('tesseract', ['--version']).status === 0
}

export function ocrMarkers(pngPath, workBase) {
  const run = spawnSync('tesseract', [pngPath, workBase, '--psm', '11', '-c', 'tessedit_char_whitelist=()0123456789', 'tsv'], { encoding: 'utf8' })
  if (run.status !== 0) return { error: 'tesseract-failed', detail: run.stderr?.slice(0, 200) }
  const rows = readFileSync(workBase + '.tsv', 'utf8').split('\n').slice(1).map(l => l.split('\t'))
  // 同一行（block/par/line）の断片を結合して「(n)」の切断を復元する
  const byLine = new Map()
  for (const r of rows) {
    if (r.length < 12 || !r[11]?.trim()) continue
    const key = r.slice(0, 5).join(':')
    const item = byLine.get(key) || { text: '', x1: Infinity, y1: Infinity, x2: 0, y2: 0, conf: 0, n: 0 }
    item.text += r[11].trim()
    item.x1 = Math.min(item.x1, +r[6]); item.y1 = Math.min(item.y1, +r[7])
    item.x2 = Math.max(item.x2, +r[6] + +r[8]); item.y2 = Math.max(item.y2, +r[7] + +r[9])
    item.conf += +r[10]; item.n++
    byLine.set(key, item)
  }
  const markers = []
  for (const item of byLine.values()) {
    const m = item.text.match(/^\((\d{1,2})\)$/)
    if (!m || item.conf / item.n < 80) continue
    markers.push({ marker: Number(m[1]), x: (item.x1 + item.x2) / 2, y: (item.y1 + item.y2) / 2, box: [item.x1, item.y1, item.x2, item.y2], conf: Math.round(item.conf / item.n) })
  }
  return { markers }
}
// --- 引出線の追跡：マーカー枠から出る細線を辿り、指し先（終端）を返す ---
export function traceLeader(gray, w, h, box) {
  const dark = (x, y) => x >= 0 && y >= 0 && x < w && y < h && gray[y * w + x] < 128
  const darkNear = (x, y) => dark(x, y) || dark(x + 1, y) || dark(x - 1, y) || dark(x, y + 1) || dark(x, y - 1)
  const [x1, y1, x2, y2] = box.map(Math.round)
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2
  // 枠の少し外側のリングから、線の入口候補を集める
  const entries = []
  for (let d = 3; d <= 14; d += 2) {
    for (let x = x1 - d; x <= x2 + d; x += 2) { if (dark(x, y1 - d)) entries.push([x, y1 - d]); if (dark(x, y2 + d)) entries.push([x, y2 + d]) }
    for (let y = y1 - d; y <= y2 + d; y += 2) { if (dark(x1 - d, y)) entries.push([x1 - d, y]); if (dark(x2 + d, y)) entries.push([x2 + d, y]) }
    if (entries.length) break
  }
  if (!entries.length) return null
  let best = null
  for (const [ex, ey] of entries.slice(0, 8)) {
    let px = ex, py = ey
    let dx = ex - cx, dy = ey - cy
    const norm = Math.hypot(dx, dy) || 1
    dx /= norm; dy /= norm
    let travelled = 0
    for (let step = 0; step < 1500; step++) {
      // 進行方向±60度から、線が続く先を選ぶ（直進を優先）
      let next = null
      for (const a of [0, 10, -10, 20, -20, 30, -30, 45, -45, 60, -60]) {
        const rad = (a * Math.PI) / 180
        const ndx = dx * Math.cos(rad) - dy * Math.sin(rad)
        const ndy = dx * Math.sin(rad) + dy * Math.cos(rad)
        const tx = Math.round(px + ndx * 2), ty = Math.round(py + ndy * 2)
        if (darkNear(tx, ty)) { next = [tx, ty, ndx, ndy]; break }
      }
      if (!next) break
      // 密集領域（機体の線画）へ入ったら、その入口を指し先とする
      let density = 0
      for (let yy = -4; yy <= 4; yy++) for (let xx = -4; xx <= 4; xx++) if (dark(next[0] + xx, next[1] + yy)) density++
      const stepLen = Math.hypot(next[0] - px, next[1] - py)
      px = next[0]; py = next[1]; dx = next[2]; dy = next[3]
      travelled += stepLen
      if (density > 45 && travelled > 30) break
    }
    if (travelled > (best?.travelled || 0)) best = { x: px, y: py, travelled }
  }
  if (!best) return null
  return { x: best.x, y: best.y, travelled: Math.round(best.travelled), method: best.travelled >= 25 ? 'leader-endpoint' : 'marker-adjacent' }
}

// 2x2平均の縮小（ビューア埋め込み用プレビュー）
export function downsample2({ pixels, w, h, channels }) {
  const nw = w >> 1, nh = h >> 1
  const out = Buffer.alloc(nw * nh * channels)
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) for (let c = 0; c < channels; c++) {
    const i = (2 * y * w + 2 * x) * channels + c
    out[(y * nw + x) * channels + c] = (pixels[i] + pixels[i + channels] + pixels[i + w * channels] + pixels[i + (w + 1) * channels]) >> 2
  }
  return { pixels: out, w: nw, h: nh, channels }
}

export const toGray = ({ pixels, w, h, channels }) => {
  if (channels === 1) return pixels
  const gray = Buffer.alloc(w * h)
  for (let i = 0; i < w * h; i++) gray[i] = (pixels[i * 3] + pixels[i * 3 + 1] + pixels[i * 3 + 2]) / 3
  return gray
}

// --- まとめ：PDF→図ページ→凡例→画像→OCR→追跡 ---
// 戻り値：{ figures: [{page, legend, image, positions}], errors } または { error }
export function extractPartPositions(buffer, { workDir, maxFigures = 2 } = {}) {
  if (!ocrAvailable()) return { error: 'ocr-unavailable', detail: 'tesseract not installed' }
  const parsed = extractPdfText(buffer, { withPositions: true })
  if (parsed.error) return { error: parsed.error }
  const ctx = openPdf(buffer)
  if (ctx.error) return { error: ctx.error }
  const pageObjs = listPages(ctx)
  const figurePages = findFigurePages(parsed.pages, parsed.pageRuns)
  if (!figurePages.length) return { error: 'no-figure-page' }
  const figures = []
  const errors = []
  for (const { pageIndex, legend } of figurePages.slice(0, maxFigures)) {
    const images = pageImages(ctx, pageObjs[pageIndex]).filter(i => i.data && i.width >= 600 && i.height >= 400)
    if (!images.length) { errors.push({ page: pageIndex + 1, reason: 'no-usable-image' }); continue }
    const image = images.sort((a, b) => b.width * b.height - a.width * a.height)[0]
    const raster = unfilterImage(image)
    if (!raster) { errors.push({ page: pageIndex + 1, reason: 'unsupported-image-encoding' }); continue }
    const png = encodePng(raster)
    const pngFile = join(workDir, `figure-p${pageIndex + 1}.png`)
    writeFileSync(pngFile, png)
    const ocr = ocrMarkers(pngFile, join(workDir, `figure-p${pageIndex + 1}`))
    if (ocr.error) { errors.push({ page: pageIndex + 1, reason: ocr.error, detail: ocr.detail }); continue }
    const gray = toGray(raster)
    const positions = []
    for (const marker of ocr.markers) {
      if (!legend.has(marker.marker)) continue
      const traced = traceLeader(gray, raster.w, raster.h, marker.box)
      positions.push({
        marker: marker.marker, name: legend.get(marker.marker), ocrConf: marker.conf,
        markerXY: [Math.round(marker.x), Math.round(marker.y)],
        // 指し先（引出線の終端）。追跡できない場合はマーカー位置のまま、根拠区分で明示する。
        x: traced ? traced.x : Math.round(marker.x), y: traced ? traced.y : Math.round(marker.y),
        basis: traced ? traced.method : 'marker-centroid', travelled: traced?.travelled ?? 0,
      })
    }
    // ビューア埋め込み用の縮小プレビュー（座標は原寸基準のまま扱う）
    let preview = raster
    while (preview.w > 1600) preview = downsample2(preview)
    let previewFile = pngFile
    if (preview !== raster) {
      previewFile = join(workDir, `figure-p${pageIndex + 1}-preview.png`)
      writeFileSync(previewFile, encodePng(preview))
    }
    figures.push({
      page: pageIndex + 1, legend: Object.fromEntries(legend),
      image: { width: raster.w, height: raster.h, pngFile, previewFile, sha256: createHash('sha256').update(png).digest('hex'), pdfObject: image.num },
      positions,
    })
  }
  if (!figures.length) return { error: 'figure-extraction-failed', errors }
  return { figures, errors }
}
