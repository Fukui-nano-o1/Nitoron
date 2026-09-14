import React, { useState } from 'react'
import { Dialog } from './ui.jsx'
import { safeUrl } from './domain.js'

// 「探す」に載せるカタログ解説。データは data/catalog/<maker>/<series>.json（原文・図なし、数値に頁）。
const modules = import.meta.glob('../data/catalog/*/*.json', { eager: true })
export const CATALOG_ENTRIES = Object.entries(modules)
  .filter(([path]) => !path.endsWith('.check.json'))
  .map(([path, mod]) => ({ id: path.replace(/^.*\/catalog\//, '').replace(/\.json$/, ''), entry: mod.default || mod }))
  .sort((a, b) => a.id.localeCompare(b.id))

function physicalPage(printed) { return typeof printed === 'string' && printed.startsWith('安-') ? Number(printed.slice(2)) + 6 : Number(printed) + 18 }
function PageRef({ entry, printed }) {
  if (printed == null) return null
  const manual = entry.sources.manual, label = typeof printed === 'string' ? printed : `印刷p.${printed}`
  return <a className="catalog-ref" href={safeUrl(manual.noticeUrl)} target="_blank" rel="noopener noreferrer" title={`取扱説明書 ${manual.partNumber} PDF ${physicalPage(printed)}ページ`}>{label}<span>PDF {physicalPage(printed)}</span></a>
}
function ProductRef({ entry }) {
  return <a className="catalog-ref" href={safeUrl(entry.sources.product.url)} target="_blank" rel="noopener noreferrer">製品ページ<span>{entry.sources.product.checkedAt}</span></a>
}

export function CatalogDialog({ entry, onClose }) {
  const manual = entry.sources.manual
  return <Dialog title={`${entry.maker} ${entry.series} ${entry.productName}`} wide className="catalog-dialog" onClose={onClose}>
    <p className="catalog-kicker">{entry.category} ／ 販売型式名 {entry.salesModel} ／ 出典：<a href={safeUrl(entry.sources.product.url)} target="_blank" rel="noopener noreferrer">製品ページ</a>（{entry.sources.product.checkedAt}確認）、<a href={safeUrl(manual.noticeUrl)} target="_blank" rel="noopener noreferrer">取扱説明書 {manual.partNumber}</a>（PDF {manual.physicalPages}頁、{manual.checkedAt}確認）</p>
    <p className="catalog-rule">公式資料を読んで自分の言葉で書いた参考情報です。原文・図は転載せず、数値には該当頁を添えています。作業の手順・条件は記載していません。必ず取扱説明書の該当頁を確認してください。{manual.pageMap}。</p>
    {entry.elements.map(el => <section key={el.id} className="catalog-element">
      <h3>{el.name}</h3><p className="catalog-summary">{el.summary}</p>
      <dl>{el.items.map(it => <React.Fragment key={it.label}><dt>{it.label}</dt><dd>{it.value}{it.source === 'product' ? <ProductRef entry={entry} /> : <PageRef entry={entry} printed={it.printed} />}{it.note && <small>{it.note}</small>}</dd></React.Fragment>)}</dl>
    </section>)}
    <section className="catalog-element"><h3>症状から探す（取扱説明書の索引）</h3>
      {entry.symptoms.map(s => <div key={s.symptom} className="catalog-symptom"><h4>{s.symptom}<PageRef entry={entry} printed={s.printed} /></h4><ul>{s.checks.map(c => <li key={c.point}>{c.point}<PageRef entry={entry} printed={c.printed} /></li>)}</ul></div>)}
    </section>
    <section className="catalog-element"><h3>製品ページと取扱説明書の照合</h3>
      <table className="catalog-table"><thead><tr><th>項目</th><th>取扱説明書</th><th>製品ページ</th><th>一致</th></tr></thead><tbody>{entry.crossCheck.map(c => <tr key={c.field}><td>{c.field}</td><td>{c.manual}</td><td>{c.product}</td><td>{c.match === true ? '一致' : c.match === false ? '不一致' : '片方のみ'}</td></tr>)}</tbody></table>
    </section>
    <section className="catalog-element"><h3>未確認</h3><ul>{entry.notVerified.map(n => <li key={n}>{n}</li>)}</ul></section>
    <p className="catalog-kicker">執筆 {entry.timing.start} 〜 {entry.timing.end || '記録中'}／読んだ頁数 {entry.timing.pagesRead}／取扱説明書 SHA-256 {manual.sha256.slice(0, 16)}…。Nitoron は株式会社クボタと関係のない非公式サイトです。</p>
  </Dialog>
}

// 「探す」の先頭行。カードをタップすると同じ画面上のダイアログで開く（別ページは作らない）。
export default function CatalogRow() {
  const [open, setOpen] = useState(null)
  if (!CATALOG_ENTRIES.length) return null
  const current = CATALOG_ENTRIES.find(e => e.id === open)
  return <section className="home-row catalog-row" aria-label="カタログ解説">
    <div className="home-row-head"><h2>カタログ解説</h2><span className="catalog-count">{CATALOG_ENTRIES.length}機種 ／ 非公式・参考情報</span></div>
    <div className="home-row-scroll">{CATALOG_ENTRIES.map(({ id, entry }) => <button type="button" key={id} className="catalog-card" onClick={() => setOpen(id)}>
      <span className="catalog-card-maker">{entry.maker} · {entry.category}</span><strong>{entry.series}</strong><span>{entry.productName}</span>
      <small>{entry.elements.length}要素 · 症状{entry.symptoms.length}件 · 数値に頁付き</small>
    </button>)}</div>
    {current && <CatalogDialog entry={current.entry} onClose={() => setOpen(null)} />}
  </section>
}
