import React, { useEffect, useState } from 'react'
import Cover from './Cover.jsx'
import { AttachmentList } from './Attachments.jsx'
import { imageAttachments } from './attachment-domain.js'
import { KINDS, SECTIONS, METRICS, number, formatNumber, safeUrl } from './domain.js'
import { MachineTargetSection } from './MachinePicker.jsx'
import Icon from './Icon.jsx'
import { sectionId, isCatalogRecord, searchSections, highlightParts, citeParts, manualOffset, manualPageHref, catalogSections, parseCatalogTitle, stripCite, repairRecordsFor, recordedCosts, costsForPart } from './catalog-domain.js'
import { listPublic } from './community.js'
import { EMPTY_FILTERS, discoverHref } from './search.js'
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
// カタログ解説の本文。公式カタログの転記の並べ替えではなく、読者の用事の順に組み直す：
// 症状から診断する（症状を選ぶ→確認箇所→修理記録へ）→ 整備の周期（表）→ 部品と費用（品番と、修理記録に記録された費用）→ 諸元（表）→ 名称・操作・安全・照合・未確認。
// 文字の羅列にしない：一覧の節は先頭の数行だけ見せて「すべて表示」で開く（Airbnb の「アメニティをすべて表示」）。
// 記録内検索は部品名・症状・数値で行を絞り、当たった節だけを当たった行だけで出す。語の正規化・型式ゆらぎは全文検索と同じ。
const PREVIEW_ROWS = 6
// 本文の一行（引用の頁は取扱説明書の頁ページへのリンク、検索語は強調）。
const inline = (text, query, cite, keyBase = 0) => cite ? citeParts(text, cite.offset).map((part, i) => part.pdf != null ? <a key={`${keyBase}-${i}`} className="cite" href={manualPageHref(cite.id, part.pdf)} title={`取扱説明書 印刷p.${part.printed}（PDF ${part.pdf}頁）`}>{part.text}</a> : highlighted(part.text, query, `${keyBase}-${i}`)) : highlighted(text, query, keyBase)
const title = text => stripCite(text).replace(/（取説の表にはなく、関連頁を索引）/, '')
// 症状から診断する：症状の札を1つ選ぶと、取扱説明書が挙げる確認箇所が番号つきで出る（頁のリンクつき）。そのまま修理記録・質問へ進める。
function DiagnosisSection({ section, cite, model }) {
  const [picked, setPicked] = useState(0)
  const group = section.groups[picked] || section.groups[0]
  if (!group) return null
  return <section className="read-section catalog-diagnosis" id={section.id}>
    <div className="section-heading"><h2>{section.title}</h2></div>
    <p className="section-lead">症状を選ぶと、取扱説明書が挙げる確認箇所が順に出ます。原因の断定や手順は書いていません。頁を開いて確かめてください。</p>
    <div className="page-chips symptom-chips" role="tablist" aria-label="症状">{section.groups.map((g, i) => <button key={g.head.id} type="button" role="tab" aria-selected={i === picked} className={`page-chip${i === picked ? ' active' : ''}`} onClick={() => setPicked(i)}>{title(g.head.text)}</button>)}</div>
    <div className="diagnosis-panel" role="tabpanel">
      <h3>{inline(group.head.text, '', cite, 'h')}</h3>
      <ol className="check-list">{group.rows.filter(b => b.text && b.type !== 'divider').map((b, i) => <li key={b.id}>{inline(b.text, '', cite, i)}</li>)}</ol>
      <div className="catalog-cta print-hidden">
        <a className="primary" href={`#/repairs/new?q=${encodeURIComponent(model)}`}><Icon name="wrench" size={16} />この症状を直した記録を書く</a>
        <a className="secondary" href={discoverHref({ query: `${model} ${title(group.head.text).slice(0, 12)}`, filters: { ...EMPTY_FILTERS, kind: 'trouble' } })}><Icon name="search" size={16} />同じ症状の修理記録を探す</a>
      </div>
    </div>
  </section>
}
// 整備の周期：一覧表を「点検箇所／周期」の表に。給油量は一行、該当頁の索引は畳んでおく。
function ScheduleSection({ section, cite, opened, open }) {
  const isOpen = opened.has(section.id)
  return <section className="read-section" id={section.id}>
    <div className="section-heading"><h2>{section.title}</h2>{section.table && <span className="state-label">{inline(section.table.text.slice(section.table.text.lastIndexOf('（')), '', cite, 't')}</span>}</div>
    {section.rows.length ? <div className="table-scroll"><table className="catalog-table"><thead><tr><th>点検箇所</th><th>周期</th></tr></thead><tbody>{section.rows.map((r, i) => <tr key={i}><td>{r.item}</td><td>{r.interval || '—'}</td></tr>)}</tbody></table></div> : null}
    {section.oil && <p className="oil-line">{inline(section.oil.text, '', cite, 'o')}</p>}
    {section.rest.length > 0 && <details className="page-index" open={isOpen} onToggle={e => e.target.open && open(section.id)}><summary>取扱説明書の該当頁（{section.rest.length}項目）</summary>{section.rest.map(b => renderBlock(b, '', cite))}</details>}
  </section>
}
// 部品と費用：取扱説明書に載る品番の表と、同じ型式の修理記録に記録された費用（日付・内容・部品・円）。費用は公式カタログにはない、この場所だけの情報。
function PartsSection({ section, cite, model }) {
  const [repairs, setRepairs] = useState(null)
  useEffect(() => {
    let cancelled = false
    if (!model) { setRepairs([]); return }
    Promise.resolve().then(() => listPublic({ query: model, filters: { ...EMPTY_FILTERS, kind: 'trouble' }, sort: 'recent', page: 0, limit: 24 }))
      .then(data => { if (!cancelled) setRepairs(repairRecordsFor(model, data.records)) })
      .catch(() => { if (!cancelled) setRepairs([]) })
    return () => { cancelled = true }
  }, [model])
  const costs = recordedCosts(repairs)
  const yen = n => `${n.toLocaleString('ja-JP')}円`
  return <section className="read-section catalog-parts" id={section.id}>
    <div className="section-heading"><h2>{section.title}</h2>{repairs && <span className="state-label">修理記録 {repairs.length}件</span>}</div>
    {section.rows.length > 0 && <div className="table-scroll"><table className="catalog-table parts-table"><thead><tr><th>部品</th><th>品番</th><th>記録された費用</th></tr></thead><tbody>{section.rows.map(r => {
      const hits = costsForPart(costs, r)
      return <tr key={r.partNumber}><td>{r.name}{r.note && <small>{r.note}</small>}</td><td className="part-number">{r.partNumber}</td><td>{hits.length ? hits.map(c => <a key={`${c.recordId}-${c.date}`} href={`#/public/${c.recordId}`}>{yen(c.cost)}<small>{c.date}</small></a>) : <span className="muted">記録なし</span>}</td></tr>
    })}</tbody></table></div>}
    {section.consumables.length > 0 && <div className="consumables">{section.consumables.map(b => renderBlock(b, '', cite))}</div>}
    <h3>この型式の修理記録に記録された費用</h3>
    {repairs === null ? <p className="muted">修理記録を確認しています…</p>
      : costs.length ? <ul className="cost-list">{costs.map(c => <li key={`${c.recordId}-${c.date}-${c.cost}`}><a href={`#/public/${c.recordId}`}><strong>{yen(c.cost)}</strong><span>{c.what || '内容未記録'}{c.parts && ` · ${c.parts}`}</span><time>{c.date}</time></a></li>)}</ul>
      : <p className="muted">{repairs.length ? 'この型式の修理記録はありますが、費用は記録されていません。' : 'この型式の修理記録はまだありません。部品代・工賃は、最初に記録した人の数字がここに載ります。'}</p>}
    <div className="catalog-cta print-hidden">
      <a className="primary" href={`#/repairs/new?q=${encodeURIComponent(model)}`}><Icon name="wrench" size={16} />費用つきの修理記録を書く</a>
      {repairs?.length > 0 && <a className="secondary" href={discoverHref({ query: model, filters: { ...EMPTY_FILTERS, kind: 'trouble' } })}><Icon name="search" size={16} />修理記録 {repairs.length}件を見る</a>}
    </div>
  </section>
}
// 諸元：「項目：値（頁）」の行を表に。前書きの一文は表の上に残す。
function SpecsSection({ section, cite, opened, open }) {
  const collapsible = section.rows.length > PREVIEW_ROWS + 2 && !opened.has(section.id)
  const rows = collapsible ? section.rows.slice(0, PREVIEW_ROWS) : section.rows
  const others = section.blocks.filter(b => b.type !== 'bullet' && b !== section.intro && b.text)
  return <section className={`read-section${collapsible ? ' collapsed' : ''}`} id={section.id}>
    <div className="section-heading"><h2>{section.title}</h2></div>
    {section.intro && <p className="section-lead">{inline(section.intro.text, '', cite, 'i')}</p>}
    <div className="table-scroll"><table className="catalog-table spec-table"><tbody>{rows.map(r => <tr key={r.block.id}>{r.label ? <th>{r.label}</th> : <th />}<td>{inline(r.label ? r.block.text.slice(r.block.text.indexOf('：') + 1) : r.block.text, '', cite, r.block.id)}</td></tr>)}</tbody></table></div>
    {!collapsible && others.map(b => renderBlock(b, '', cite))}
    {collapsible && <button className="secondary show-all print-hidden" onClick={() => open(section.id)}>すべて表示（{section.rows.length}件）</button>}
  </section>
}
// search（{ query, onQuery }）が渡されたときは検索欄を上部の固定バー（PublicRecord の節ナビ）に任せ、本文には結果だけを出す。
function CatalogBody({ record, search = null, focusSection = '' }) {
  const [own, setOwn] = useState('')
  const query = search ? search.query : own, setQuery = search ? search.onQuery : setOwn
  // 焦点を当てる節（頁ページの小見出しから来た節）は畳まずに全行を出す。
  const [opened, setOpened] = useState(() => new Set(focusSection ? [focusSection] : []))
  useEffect(() => { if (focusSection) setOpened(prev => prev.has(focusSection) ? prev : new Set(prev).add(focusSection)) }, [focusSection])
  const open = id => setOpened(prev => prev.has(id) ? prev : new Set(prev).add(id))
  const found = searchSections(record.blocks, query)
  const sections = catalogSections(record.blocks)
  const cite = { id: record.id, offset: manualOffset(record.blocks) }
  const model = parseCatalogTitle(record.title)?.model || ''
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
    {sections.map(section => {
      if (section.kind === 'diagnosis') return <DiagnosisSection key={section.id} section={section} cite={cite} model={model} />
      if (section.kind === 'schedule') return <ScheduleSection key={section.id} section={section} cite={cite} opened={opened} open={open} />
      if (section.kind === 'parts') return <PartsSection key={section.id} section={section} cite={cite} model={model} />
      if (section.kind === 'specs') return <SpecsSection key={section.id} section={section} cite={cite} opened={opened} open={open} />
      const rows = section.blocks.filter(b => b.text && b.type !== 'divider').length
      const collapsible = !!section.heading && rows > PREVIEW_ROWS + 2 && !opened.has(section.id)
      let shown = 0
      const body = section.blocks.map(b => { if (collapsible && b.text && b.type !== 'divider') { if (shown >= PREVIEW_ROWS) return null; shown++ } return renderBlock(b, '', cite) })
      return <section className={`read-section${collapsible ? ' collapsed' : ''}${section.kind === 'lead' ? ' catalog-lead' : ''}`} key={section.id} id={section.heading ? section.id : undefined}>
        {section.heading && <div className="section-heading"><h2>{section.title}</h2></div>}
        {body}
        {collapsible && <button className="secondary show-all print-hidden" onClick={() => open(section.id)}>すべて表示（{rows}件）</button>}
      </section>
    })}
  </>
}
