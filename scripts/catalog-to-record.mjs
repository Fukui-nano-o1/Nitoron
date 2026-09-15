// data/catalog/<maker>/<series>.json → 通常の記録（nitoron-workspace バックアップ形式）。
// 「自分の実践」の「バックアップを取り込む」で読み込み、運営アカウントから通常どおり公開する。
// 記録の設計（title / meta / blocks）は既存の発表と同じ。別画面・別ページは作らない。
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { emptyMeta } from '../src/domain.js'

const [,, input, output] = process.argv
if (!input) { console.error('使い方: node scripts/catalog-to-record.mjs data/catalog/kubota/tms-200.json [out.record.json]'); process.exit(2) }
const entry = JSON.parse(await readFile(input, 'utf8'))
const manual = entry.sources.manual, product = entry.sources.product
// 同じ入力からは同じIDにする（再取込で重複しないよう、取り込む側で判断できる）
const stableUuid = seed => { const h = createHash('sha256').update(seed).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}` }
const id = stableUuid(`nitoron-catalog:${entry.maker}:${entry.series}`)
// 写真と出典の登録台帳を再生成時にも引き継ぐ。
const photoRegistry = JSON.parse(await readFile(new URL('../data/card-photos.json', import.meta.url), 'utf8'))
const photo = photoRegistry.entries.find(item => item.id === id)
let n = 0
const block = (type, text) => ({ id: `${id.slice(0, 8)}-${String(++n).padStart(3, '0')}`, type, text })
// 頁対応（印刷頁→PDF頁）は取説ごとに違うので、データの bodyOffset／safetyOffset を使う（TMS-200 は 18／6）。
const physical = printed => typeof printed === 'string' && printed.startsWith('安-') ? Number(printed.slice(2)) + (manual.safetyOffset ?? 6) : Number(printed) + manual.bodyOffset
const ref = printed => printed == null ? '' : `（${typeof printed === 'string' ? printed : `印刷p.${printed}`}／PDF ${physical(printed)}）`

const blocks = [
  block('callout', `公式資料を読んで自分の言葉で書いた参考情報です。原文・図は転載せず、数値には該当頁を添えています。作業の手順・条件は記載していません。必ず取扱説明書の該当頁を確認してください。${manual.pageMap}。Nitoron は株式会社クボタと関係のない非公式サイトです。`),
  block('text', `販売型式名 ${entry.salesModel}${entry.aliases?.length ? `（読み・別名：${entry.aliases.join('、')}）` : ''}。出典：製品ページ（${product.checkedAt}確認）、取扱説明書 ${manual.partNumber}（PDF ${manual.physicalPages}頁、${manual.checkedAt}確認）。`),
]
// 節見出しは読む人向けの語に揃える（Airbnb の listing のように、節ごとに何が書いてあるかが見出しで分かるように）。
const SECTION_TITLES = { 'エンジン': 'エンジン', '走行': '走行部', '作業部': '作業部', '操作': '操作方法', '安全': '安全に使うために', '整備（索引）': '整備と点検（索引）' }
const isPartsList = it => /^各部の名称/.test(it.label)
// 「部品の名称」：各部の名称の項目（図の一覧）を、本文の先頭で1部品1行にする。
const partsItem = entry.elements.flatMap(el => el.items).find(isPartsList)
if (partsItem) {
  blocks.push(block('h2', '部品の名称'), block('text', `取扱説明書の各部の名称の図に載っている部品${ref(partsItem.printed)}。`))
  for (const name of partsItem.value.split('／').map(s => s.trim()).filter(Boolean)) blocks.push(block('bullet', name))
}
for (const el of entry.elements) {
  blocks.push(block('h2', SECTION_TITLES[el.name] || el.name), block('text', el.summary))
  for (const it of el.items.filter(it => !isPartsList(it))) blocks.push(block('bullet', `${it.label}：${it.value}${it.source === 'product' ? `（製品ページ・${product.checkedAt}）` : ref(it.printed)}${it.note ? ` — ${it.note}` : ''}`))
}
blocks.push(block('h2', '症状から探す（取扱説明書の索引）'))
for (const s of entry.symptoms) { blocks.push(block('h3', `${s.symptom}${ref(s.printed)}`)); for (const c of s.checks) blocks.push(block('bullet', `${c.point}${ref(c.printed)}`)) }
blocks.push(block('h2', '製品ページと取扱説明書の照合'))
for (const c of entry.crossCheck) blocks.push(block('bullet', `${c.field}：取扱説明書 ${c.manual} ／ 製品ページ ${c.product} → ${c.match === true ? '一致' : c.match === false ? '不一致' : '片方のみ'}`))
blocks.push(block('h2', '未確認'))
for (const v of entry.notVerified) blocks.push(block('bullet', v))
blocks.push(block('divider', ''), block('text', `執筆 ${entry.timing.start} 〜 ${entry.timing.end || '記録中'}／読んだ頁数 ${entry.timing.pagesRead}／取扱説明書 SHA-256 ${manual.sha256.slice(0, 16)}…`))

const meta = { ...emptyMeta('trouble'), inputMode: 'free',
  coverUrl: photo?.url || '',
  author: `${entry.maker}カタログ解説（Nitoron運営・非公式）`, club: 'Nitoron / 4H Club', crop: entry.category,
  summary: `${entry.maker} ${entry.series}（${entry.productName}）の公式カタログと取扱説明書を、分野ごと・要素ごとに自分の言葉でまとめた解説。数値には頁を添え、手順は書いていない。`,
  sources: [
    { id: `${id.slice(0, 8)}-src-product`, title: `${entry.maker} 製品ページ ${entry.series} ${entry.productName}`, url: product.url, date: product.checkedAt },
    { id: `${id.slice(0, 8)}-src-manual`, title: `${entry.maker} 取扱説明書 ${manual.partNumber}（${entry.salesModel}）`, url: manual.noticeUrl, date: manual.checkedAt },
    ...(photo ? [photo.source] : []),
  ] }
const record = { id, title: `【カタログ解説】${entry.maker} ${entry.series} ${entry.productName}（${entry.category}）`, category: entry.category, type: 'メモ', date: (entry.timing.end || entry.timing.start).slice(0, 10), blocks, meta }
const backup = { format: 'nitoron-workspace', version: 1, exportedAt: `${record.date}T00:00:00.000Z`, records: [record] }
const out = output || input.replace(/\.json$/, '.record.json')
await writeFile(out, JSON.stringify(backup, null, 2) + '\n')
console.log(JSON.stringify({ out, id, blocks: blocks.length, sources: meta.sources.length }))
