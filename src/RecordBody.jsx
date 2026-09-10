import React from 'react'
import Cover from './Cover.jsx'
import { AttachmentList } from './Attachments.jsx'
import { imageAttachments } from './attachment-domain.js'
import { KINDS, SECTIONS, METRICS, number, formatNumber, safeUrl } from './domain.js'
export default function RecordBody({ record, hideHeading = false, hideCover = false }) {
  const m = record.meta
  return <div className="record-body">
    {!hideHeading && <><div className="record-kicker">{KINDS[m?.kind || 'memo']}{m?.kind === 'challenge' && ` / ${m.stage}`}</div>
    <h1>{record.title || '無題'}</h1>
    <div className="byline">{m?.author || '発表者未記録'}{m?.club && ` · ${m.club}`}<span>記録日 {record.date}</span></div></>}
    {!hideCover && (m?.coverUrl || imageAttachments(record).length > 0) && <Cover record={record} className="reading-cover" eager />}
    {m && <>
      {m.summary && <p className="record-summary" id="document-summary">{m.summary}</p>}
      <dl className="conditions-grid">
        {[['作物・品種', [m.crop, m.variety].filter(Boolean).join(' / ')], ['地域', m.region], ['対象面積', m.areaA ? `${m.areaA} a` : ''], ['対象期間', m.start || m.end ? `${m.start || '未記録'}〜${m.end || '未記録'}` : '']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '未記録'}</dd></div>)}
      </dl>
      {m.conditions && <p className="conditions-note">比較の条件：{m.conditions}</p>}
      {m.origin && <p className="source-line">参考にした記録：{m.origin.public ? <a href={`#/public/${m.origin.id}`}>{m.origin.title}</a> : m.origin.title}</p>}
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
    {!!record.blocks.filter(b => b.text).length && <section className="read-section">{m?.inputMode === 'sections' && <h2>補足</h2>}{record.blocks.map(b => {
      if (b.type === 'divider') return <hr key={b.id} />
      if (!b.text) return null
      if (['h1', 'h2', 'h3'].includes(b.type)) return <h3 key={b.id}>{b.text}</h3>
      if (b.type === 'quote') return <blockquote key={b.id}>{b.text}</blockquote>
      return <p key={b.id} className={b.type === 'callout' ? 'notice' : ''}>{b.type === 'todo' ? (b.checked ? '☑ ' : '☐ ') : b.type === 'bullet' ? '• ' : ''}{b.text}</p>
    })}</section>}
  </div>
}
