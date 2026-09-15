import React, { useEffect, useState } from 'react'
import Cover from './Cover.jsx'
import { AttachmentList } from './Attachments.jsx'
import { imageAttachments } from './attachment-domain.js'
import { KINDS, SECTIONS, METRICS, number, formatNumber, safeUrl } from './domain.js'
import { MachineTargetSection } from './MachinePicker.jsx'
import Icon from './Icon.jsx'
import { sectionId, isCatalogRecord, groupSection, searchSections, highlightParts, citeParts, manualOffset, manualPageHref } from './catalog-domain.js'
// 本文を h2 ごとの節に分ける（h2 が空文字のものは見出しにしない）。先頭の h2 より前は見出しなしの節。
function bodySections(blocks) {
  const sections = []
  for (const b of blocks) {
    if (b.type === 'h2' && String(b.text || '').trim()) sections.push({ heading: b, blocks: [] })
    else { if (!sections.length) sections.push({ heading: null, blocks: [] }); sections[sections.length - 1].blocks.push(b) }
  }
  return sections.filter(s => s.heading || s.blocks.some(b => b.text))
}
export default function RecordBody({ record, hideHeading = false, hideCover = false, search = null, focusSection = '' }) {
  const m = record.meta
  return <div className="record-body">
    {!hideHeading && <><div className="record-kicker">{KINDS[m?.kind || 'memo']}{m?.kind === 'challenge' && ` / ${m.stage}`}</div>
    <h1>{record.title || '無題'}</h1>
    <div className="byline">{m?.author || '記録者未記録'}{m?.club && ` · ${m.club}`}<span>記録日 {record.date}</span></div></>}
    {!hideCover && (m?.coverUrl || imageAttachments(record).length > 0) && <Cover record={record} className="reading-cover" eager />}
    {m && <>
      {m.summary && <p className="record-summary" id="document-summary">{m.summary}</p>}
      {(() => {
        // 入力のある条件だけ出す。カタログ解説や修理記録に「作物 未記録」を並べない。
        const rows = [[m.kind === 'trouble' ? '分類' : '作物・品種', [m.crop, m.variety].filter(Boolean).join(' / ')], ['地域', m.region], ['対象面積', m.areaA ? `${m.areaA} a` : ''], ['対象期間', m.start || m.end ? `${m.start || '未記録'}〜${m.end || '未記録'}` : '']].filter(([, value]) => value)
        return rows.length ? <dl className="conditions-grid">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : null
      })()}
      {m.conditions && <p className="conditions-note">比較の条件：{m.conditions}</p>}
      <MachineTargetSection meta={m} />
      {m.origin && (m.origin.public ? <p className="source-line">参考にした記録：<a href={`#/public/${m.origin.id}`}>{m.origin.title}</a></p> : <p className="source-line">参考にした記録：非公開の記録（タイトル・リンクは公開されません）</p>)}
      {m.kind === 'challenge' && <div className="challenge-plan"><h2>挑戦の計画</h2><dl><dt>進捗</dt><dd>{m.stage}</dd><dt>目標</dt><dd>{m.target || '未記録'}</dd><dt>確かめる方法・判定基準</dt><dd>{m.criterion || '未記録'}</dd><dt>振り返る日</dt><dd>{m.deadline || '未記録'}</dd><dt>本人の判定</dt><dd>{m.verdict || '未選択'}</dd></dl><p className="hint">判定は、目標・判定基準と結果・観測を見比べて本人が選んだものです。観測件数から自動では決まりません。</p></div>}
      {SECTIONS.map(([key, label], i) => m[key] ? <section id={`section-${key}`} className="read-section" key={key}>
        <div className="section-heading"><span className="section-number">{String(i + 1).padStart(2, '0')}</span><h2>{label}</h2>{key === 'hypothesis' && <span className="state-label">未検証の見立て</span>}{key === 'interpretation' && <span className="state-label">事実からの解釈</span>}</div><p>{m[key]}</p>
      </section> : null)}
      {!!m.observations.length && <section className="read-section"><div className="section-heading"><span className="section-number">DATA</span><h2>観測した事実</h2></div>
        {m.observations.map(o => <div className="observation" key={o.id}><time>{o.date || '日付未記録'}</time><div><p>{o.fact || '事実未記録'}</p><small>条件：{o.conditions || '未記録'}<br />根拠：{o.evidence || '未記録'}</small></div></div>)}
      </section>}
      {METRICS.some(([key]) => number(m[key]) !== null) && <section className="read-section"><div className="section-heading"><span className="section-number">NUMBERS</span><h2>経営の数字</h2></div><div className="metric-strip">
        {METRICS.map(([key, label, unit]) => <div key={key}><span>{label}</span><strong>{formatNumber(number(m[key]))}<small>{number(m[key]) === null ? '' : unit}</small></strong></div>)}
      </div><p className="hint">対象期間・対象面積の合計値。経費に含めた範囲は比較条件を参照。</p></section>}
      {!!m.sources.length && <section className="read-section"><h2>出典・資料</h2>{m.sources.map(s => <p className="source-line" key={s.id}>{safeUrl(s.url) ? <a href={safeUrl(s.url)} rel="noopener noreferrer" target="_blank">{s.title || s.url}</a> : s.title || '資料名未記録'}{s.date && <span> · {s.date}</span>}</p>)}</section>}
    </>}
    <AttachmentList attachments={m?.attachments} />
    {!!record.blocks.filter(b => b.text).length && (isCatalogRecord(record) ? <CatalogBody record={record} search={search} focusSection={focusSection} /> : bodySections(record.blocks).map((section, i) => <section className="read-section" key={section.heading?.id || `lead-${i}`} id={section.heading ? sectionId(section.heading) : undefined}>
      {section.heading ? <div className="section-heading"><h2>{section.heading.text}</h2></div> : m?.inputMode === 'sections' && <h2>補足</h2>}
      {section.blocks.map(b => renderBlock(b))}
    </section>))}
  </div>
}
// 1ブロックの表示。query があれば当たった語を <mark> にする。cite（{ id, offset }）があれば頁の引用を取扱説明書の頁ページへのリンクにする。
const highlighted = (text, query, keyBase) => query ? highlightParts(text, query).map((part, i) => part.mark ? <mark key={`${keyBase}-${i}`}>{part.text}</mark> : part.text) : text
export function renderBlock(b, query = '', cite = null) {
  if (b.type === 'divider') return <hr key={b.id} />
  if (!b.text) return null
  const text = cite ? citeParts(b.text, cite.offset).map((part, i) => part.pdf != null ? <a key={i} className="cite" href={manualPageHref(cite.id, part.pdf)} title={`取扱説明書 印刷p.${part.printed}（PDF ${part.pdf}頁）`}>{part.text}</a> : highlighted(part.text, query, i)) : highlighted(b.text, query, 0)
  if (['h1', 'h3'].includes(b.type)) return <h3 key={b.id}>{text}</h3>
  if (b.type === 'quote') return <blockquote key={b.id}>{text}</blockquote>
  return <p key={b.id} className={b.type === 'callout' ? 'notice' : ''}>{b.type === 'todo' ? (b.checked ? '☑ ' : '☐ ') : b.type === 'bullet' ? '• ' : ''}{text}</p>
}
// カタログ解説の本文。文字の羅列にしない：節は先頭の数行だけ見せて「すべて表示」で開く（Airbnb の「アメニティをすべて表示」）。
// 記録内検索は部品名・症状・数値で行を絞り、当たった節だけを当たった行だけで出す。語の正規化・型式ゆらぎは全文検索と同じ。
const PREVIEW_ROWS = 6
// search（{ query, onQuery }）が渡されたときは検索欄を上部の固定バー（PublicRecord の節ナビ）に任せ、本文には結果だけを出す。
function CatalogBody({ record, search = null, focusSection = '' }) {
  const [own, setOwn] = useState('')
  const query = search ? search.query : own, setQuery = search ? search.onQuery : setOwn
  // 焦点を当てる節（頁ページの小見出しから来た節）は畳まずに全行を出す。
  const [opened, setOpened] = useState(() => new Set(focusSection ? [focusSection] : []))
  useEffect(() => { if (focusSection) setOpened(prev => prev.has(focusSection) ? prev : new Set(prev).add(focusSection)) }, [focusSection])
  const found = searchSections(record.blocks, query)
  const sections = bodySections(record.blocks)
  const cite = { id: record.id, offset: manualOffset(record.blocks) }
  const searchBox = search ? null : <div className="record-search print-hidden" role="search"><Icon name="search" size={18} /><input type="search" maxLength={160} value={query} onChange={e => setQuery(e.target.value)} placeholder="この記録の中を探す（部品名・症状・数値）" aria-label="この記録の中を探す" />{query && <button className="quiet" onClick={() => setQuery('')}>クリア</button>}</div>
  if (found) return <>
    {searchBox}
    <p className="record-search-count" id="record-search-results" role="status">{found.length ? `「${query.trim()}」に当たる行 ${found.reduce((n, s) => n + s.total, 0)}件（${found.length}節）` : `「${query.trim()}」に当たる行はありません。型式・部品名・症状・数値で探せます。`}</p>
    {found.map(s => <section className="read-section" key={s.id} id={s.id}>
      {s.title && <div className="section-heading"><h2>{s.title}</h2><span className="state-label">{s.total}件</span></div>}
      {s.groups.map((g, i) => <React.Fragment key={g.head?.id || i}>{g.head && renderBlock(g.head, query, cite)}{g.rows.map(b => renderBlock(b, query, cite))}</React.Fragment>)}
    </section>)}
  </>
  return <>
    {searchBox}
    {sections.map((section, i) => {
      const id = section.heading ? sectionId(section.heading) : `lead-${i}`
      const rows = section.blocks.filter(b => b.text && b.type !== 'divider').length
      const collapsible = !!section.heading && rows > PREVIEW_ROWS + 2 && !opened.has(id)
      let shown = 0
      const body = section.blocks.map(b => { if (collapsible && b.text && b.type !== 'divider') { if (shown >= PREVIEW_ROWS) return null; shown++ } return renderBlock(b, '', cite) })
      return <section className={`read-section${collapsible ? ' collapsed' : ''}`} key={id} id={section.heading ? id : undefined}>
        {section.heading && <div className="section-heading"><h2>{section.heading.text}</h2></div>}
        {body}
        {collapsible && <button className="secondary show-all print-hidden" onClick={() => setOpened(prev => new Set(prev).add(id))}>すべて表示（{rows}件）</button>}
      </section>
    })}
  </>
}
