import React from 'react'
import Icon from './Icon.jsx'
import { renderBlock } from './RecordBody.jsx'
import { parseCatalogTitle, manualOffset, citedPages, sectionsCitingPage, manualPageHref, manualSource, pdfPageUrl } from './catalog-domain.js'
// 取扱説明書の頁ページ（#/public/:id/manual/:pdf）。本文の「（印刷p.56／PDF 62）」を押すと来る。
// 取説の原文・図は載せない。この解説がその頁から引いた行だけをまとめ、メーカーのサイトの PDF をその頁で開く入口を置く。
export default function ManualPage({ record, pdf }) {
  const page = Number(pdf), p = parseCatalogTitle(record.title), offset = manualOffset(record.blocks), pages = citedPages(record.blocks), src = manualSource(record)
  const printed = Number.isInteger(page) && offset != null ? page - offset : null
  const sections = printed == null ? [] : sectionsCitingPage(record.blocks, printed, offset)
  const total = sections.reduce((n, s) => n + s.total, 0)
  const idx = pages.findIndex(x => x.pdf === page), prev = idx > 0 ? pages[idx - 1] : pages.filter(x => x.pdf < page).pop(), next = idx >= 0 ? pages[idx + 1] : pages.find(x => x.pdf > page)
  const cite = { id: record.id, offset }
  return <article className="listing-page manual-page">
    <div className="listing-back"><a href={`#/public/${record.id}`}><Icon name="left" size={16} /><span>解説へ戻る</span></a><span>取扱説明書の頁</span></div>
    <header className="listing-title"><span className="listing-kind">{[p?.maker, p?.model].filter(Boolean).join(' ')}</span>
      <h1>{printed == null ? `PDF ${pdf}頁` : <>取扱説明書 印刷p.{printed}<small>（PDF {page}頁）</small></>}</h1>
      <p className="manual-record"><a href={`#/public/${record.id}`}>{record.title}</a></p></header>
    <div className="manual-actions">
      {src ? <a className="primary" href={pdfPageUrl(src.pdfUrl, page)} target="_blank" rel="noopener noreferrer">{p?.maker || 'メーカー'}の取扱説明書でこの頁を開く</a> : <p className="notice">この記録には取扱説明書のリンクがありません。</p>}
      {src && <p className="hint">メーカーのサイトの PDF（{src.title}）が新しいタブで開きます。PC のブラウザは PDF {page}頁から始まります。スマホは1頁目から開くことがあるので、その場合は {page}頁へ進んでください。原文・図はこのサイトには載せていません。</p>}
    </div>
    <nav className="manual-pager" aria-label="前後の頁">{prev ? <a href={manualPageHref(record.id, prev.pdf)}>← 印刷p.{prev.printed}</a> : <span />}<span>この頁を引く行 {total}件</span>{next ? <a href={manualPageHref(record.id, next.pdf)}>印刷p.{next.printed} →</a> : <span />}</nav>
    {sections.length ? sections.map(s => <section className="read-section record-body" key={s.id}>
      {s.title && <div className="section-heading"><h2><a href={`#/public/${record.id}`} onClick={e => { e.preventDefault(); location.hash = `/public/${record.id}`; setTimeout(() => document.getElementById(s.id)?.scrollIntoView({ block: 'start' }), 300) }}>{s.title}</a></h2><span className="state-label">{s.total}件</span></div>}
      {s.groups.map((g, i) => <React.Fragment key={g.head?.id || i}>{g.head && renderBlock(g.head, '', cite)}{g.rows.map(b => renderBlock(b, '', cite))}</React.Fragment>)}
    </section>) : <p className="empty-line">この頁を引いた行はこの解説にありません。下の一覧から引いた頁を選べます。</p>}
    {!!pages.length && <section className="manual-index"><h2>この解説が引いた頁（{pages.length}頁）</h2><div className="page-chips">{pages.map(x => <a key={x.printed} className={`page-chip${x.pdf === page ? ' active' : ''}`} href={manualPageHref(record.id, x.pdf)} aria-current={x.pdf === page ? 'page' : undefined}>p.{x.printed}<small>{x.count}</small></a>)}</div></section>}
  </article>
}
