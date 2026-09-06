// Word / Excel / PDF / テキストをブラウザ内で解析し、メモのブロック列に変換する。
// パーサーは重いので必要になったときだけ動的importで読み込む。

const uid = () => crypto.randomUUID()
const block = (text = '', type = 'text') => ({ id: uid(), type, text })

export const IMPORT_ACCEPT = '.docx,.xlsx,.xlsm,.xls,.csv,.tsv,.pdf,.txt,.md'

const MAX_ROWS_PER_SHEET = 300
const MAX_BLOCKS = 600

const capBlocks = (blocks) => {
  if (blocks.length <= MAX_BLOCKS) return blocks
  const omitted = blocks.length - MAX_BLOCKS
  return [...blocks.slice(0, MAX_BLOCKS), block(`長いファイルのため、残り${omitted}ブロックは省略しました。`, 'callout')]
}

/* ---------- Word (.docx) ---------- */

async function fromDocx(buffer) {
  const mod = await import('mammoth')
  const mammoth = mod.default || mod
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer })
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks = []
  const pushText = (el, type) => { const t = el.textContent.trim(); if (t) blocks.push(block(t, type)) }
  const walk = (parent) => {
    for (const el of parent.children) {
      const tag = el.tagName
      if (tag === 'H1') pushText(el, 'h1')
      else if (tag === 'H2') pushText(el, 'h2')
      else if (/^H[3-6]$/.test(tag)) pushText(el, 'h3')
      else if (tag === 'P') pushText(el, 'text')
      else if (tag === 'UL' || tag === 'OL') {
        for (const li of el.querySelectorAll(':scope > li')) pushText(li, tag === 'OL' ? 'number' : 'bullet')
      }
      else if (tag === 'BLOCKQUOTE') pushText(el, 'quote')
      else if (tag === 'TABLE') {
        for (const tr of el.querySelectorAll('tr')) {
          const cells = [...tr.children].map((c) => c.textContent.trim())
          if (cells.some(Boolean)) blocks.push(block(cells.join(' | ')))
        }
      }
      else if (tag === 'HR') blocks.push(block('', 'divider'))
      else walk(el)
    }
  }
  walk(doc.body)
  return blocks
}

/* ---------- Excel / CSV (.xlsx .xls .csv .tsv) ---------- */

// ExcelのCSV書き出しはShift_JISが多いので、UTF-8で読めなければShift_JISで読み直す。
const decodeText = (buffer) => {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer) }
  catch { return new TextDecoder('shift_jis').decode(buffer) }
}

async function fromSheet(buffer, isCsv) {
  const XLSX = await import('xlsx')
  const wb = isCsv ? XLSX.read(decodeText(buffer), { type: 'string' }) : XLSX.read(buffer, { type: 'array' })
  const blocks = []
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' })
      .map((row) => {
        const cells = row.map((cell) => String(cell ?? '').trim())
        while (cells.length && !cells[cells.length - 1]) cells.pop()
        return cells
      })
      .filter((cells) => cells.some(Boolean))
    if (!rows.length) continue
    if (wb.SheetNames.length > 1) blocks.push(block(name, 'h2'))
    for (const cells of rows.slice(0, MAX_ROWS_PER_SHEET)) blocks.push(block(cells.join(' | ')))
    if (rows.length > MAX_ROWS_PER_SHEET) blocks.push(block(`残り${rows.length - MAX_ROWS_PER_SHEET}行は省略しました。`, 'callout'))
  }
  return blocks
}

/* ---------- PDF (.pdf) ---------- */

async function fromPdf(buffer) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer) })
  const doc = await task.promise
  const blocks = []
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const lines = []
      let line = ''
      let lastY = null
      for (const item of content.items) {
        if (typeof item.str !== 'string') continue
        const y = item.transform?.[5]
        if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2 && line) { lines.push(line); line = '' }
        line += item.str
        if (item.hasEOL) { lines.push(line); line = '' }
        if (y !== undefined) lastY = y
      }
      if (line) lines.push(line)
      const texts = lines.map((l) => l.trim()).filter(Boolean)
      if (!texts.length) continue
      if (doc.numPages > 1) blocks.push(block(`${i}ページ`, 'h3'))
      for (const t of texts) blocks.push(block(t))
    }
  } finally {
    Promise.resolve(task.destroy()).catch(() => {})
  }
  return blocks
}

/* ---------- プレーンテキスト / Markdown (.txt .md) ---------- */

const MD_PREFIXES = [['# ', 'h1'], ['## ', 'h2'], ['### ', 'h3'], ['- ', 'bullet'], ['* ', 'bullet'], ['> ', 'quote']]

function fromText(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    if (line === '---') return block('', 'divider')
    for (const [prefix, type] of MD_PREFIXES) {
      if (line.startsWith(prefix)) return block(line.slice(prefix.length), type)
    }
    return block(line)
  })
}

/* ---------- 入口 ---------- */

export async function importFile(file) {
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase() : ''
  const title = file.name.replace(/\.[^.]+$/, '')
  let blocks
  if (ext === 'docx') blocks = await fromDocx(await file.arrayBuffer())
  else if (['xlsx', 'xlsm', 'xls', 'csv', 'tsv'].includes(ext)) blocks = await fromSheet(await file.arrayBuffer(), ext === 'csv' || ext === 'tsv')
  else if (ext === 'pdf') blocks = await fromPdf(await file.arrayBuffer())
  else if (ext === 'txt' || ext === 'md' || (file.type || '').startsWith('text/')) blocks = fromText(await file.text())
  else throw new Error(`${file.name} は未対応の形式です`)
  blocks = capBlocks(blocks)
  if (!blocks.length) blocks = [block()]
  return { title, blocks }
}
