import React, { useState } from 'react'
import { SECTIONS, METRICS, number, formatNumber, safeUrl } from './domain.js'
import { sanitizeAttachments, fileSize } from './attachment-domain.js'
import { openAttachment } from './assets.js'
import { repairLookup } from './repair-workspace.mjs'
import { RepairContent } from './RepairEntry.jsx'

const filled = value => value != null && String(value).trim() !== ''
const list = value => Array.isArray(value) ? value : []
const sectionLabels = { issue: '症状・課題', action: '実施したこと', result: '結果' }

function Values({ values }) {
  const rows = values.filter(([, value]) => filled(value))
  return rows.length ? <dl className="conditions-grid">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : null
}

// Only the supplied record is read. Attachments are fetched by an explicit click;
// opening this drawer does not load another record or acquire the shared 3D view.
export default function RepairRecordInfo({ record }) {
  const [busy, setBusy] = useState(''), [error, setError] = useState('')
  if (!record) return null
  const m = record.meta || {}, target = repairLookup(m.machineRef)
  const observations = list(m.observations).filter(o => o && ['date', 'fact', 'conditions', 'evidence'].some(key => filled(o[key])))
  const sources = list(m.sources).filter(s => s && ['title', 'url', 'date'].some(key => filled(s[key])))
  const metrics = METRICS.filter(([key]) => number(m[key]) !== null)
  const files = sanitizeAttachments(m.attachments)
  const blocks = list(record.blocks).filter(b => b && (b.type === 'divider' || filled(b.text)))
  const publicOrigin = m.origin?.public === true && filled(m.origin.id)
  const coverUrl = safeUrl(m.coverUrl)
  const personalPlan = [['進捗', m.stage], ['本人の判定', m.verdict], ['目標', m.target], ['判定基準', m.criterion], ['確認予定日', m.deadline]]
  return <div className="record-body repair-record-info">
    {filled(record.title) && <h2>{record.title}</h2>}
    <Values values={[
      ['記録者', m.author], ['所属', m.club], ['記録日', record.date],
      ['分類', record.category === '未分類' ? '' : record.category],
      ['記録の種類', record.type === 'メモ' ? '' : record.type],
      ['機械', m.machineRef ? target.machineLabel : ''],
      ['対象部品', m.machineRef ? target.partLabel : ''],
      ['モデル版', m.machineRef?.modelVersion],
    ]} />
    {m.repair && <RepairContent repair={m.repair} fallbackSymptom={m.issue} compact />}
    {filled(m.summary) && <section className="read-section"><h3>要約</h3><p>{m.summary}</p></section>}
    {coverUrl && <p><a href={coverUrl} rel="noopener noreferrer" target="_blank">表紙の画像を開く</a></p>}
    <Values values={[
      ['作物・品種', [m.crop, m.variety].filter(filled).join(' / ')], ['地域', m.region],
      ['対象面積', filled(m.areaA) ? `${m.areaA} a` : ''],
      ['開始日', m.start], ['終了日', m.end], ['条件', m.conditions],
    ]} />
    {SECTIONS.filter(([key]) => !(key === 'issue' && m.repair && !filled(m.repair.symptom?.text))).map(([key, label]) => filled(m[key]) ? <section className="read-section" key={key}>
      <h3>{sectionLabels[key] || label}</h3>
      {key === 'hypothesis' && <span className="state-label">未検証の見立て</span>}
      {key === 'interpretation' && <span className="state-label">事実からの解釈</span>}
      <p>{m[key]}</p>
    </section> : null)}
    {observations.length > 0 && <section className="read-section"><h3>観測した事実</h3>{observations.map((o, i) => <div className="observation" key={o.id || i}>
      {filled(o.date) && <time>{o.date}</time>}<div>{filled(o.fact) && <p>{o.fact}</p>}<Values values={[["条件", o.conditions], ["根拠", o.evidence]]} /></div>
    </div>)}</section>}
    {personalPlan.some(([, value]) => filled(value)) && <section className="read-section"><h3>本人の記録</h3><Values values={personalPlan} /><p className="hint">進捗・判定は記録者の入力です。修理完了の自動判定ではありません。</p></section>}
    {metrics.length > 0 && <section className="read-section"><h3>記録した数値</h3><Values values={metrics.map(([key, label, unit]) => [label, `${formatNumber(number(m[key]))} ${unit}`])} /></section>}
    {m.origin && <section className="read-section"><h3>参考にした記録</h3>{publicOrigin
      ? <a href={`#/public/${encodeURIComponent(m.origin.id)}`}>{filled(m.origin.title) ? m.origin.title : '公開されている記録'}</a>
      : <p>非公開の記録</p>}</section>}
    {sources.length > 0 && <section className="read-section"><h3>出典・資料</h3>{sources.map((s, i) => {
      const href = safeUrl(s.url)
      return <div className="source-line" key={s.id || i}>
        {href ? <a href={href} rel="noopener noreferrer" target="_blank">{s.title || s.url}</a> : <span>{[s.title, s.url].filter(filled).join(' · ')}</span>}
        {filled(s.date) && <span> · {s.date}</span>}
      </div>
    })}</section>}
    {files.length > 0 && <section className="attachment-section"><h3>写真・資料</h3><div className="attachment-list">{files.map(a => <button key={a.path} className="attachment-download" disabled={busy === a.path} onClick={async () => {
      setBusy(a.path); setError('')
      try { await openAttachment(a) } catch (e) { setError(e?.message || '資料を開けませんでした。') } finally { setBusy('') }
    }}><span><strong>{a.name}</strong><small>{a.caption || fileSize(a.size)}</small></span><span>{busy === a.path ? '取得中…' : '開く'}</span></button>)}</div>{error && <p className="error-notice" role="alert">{error}</p>}</section>}
    {blocks.some(b => filled(b.text)) && <section className="read-section"><h3>記録本文</h3>{blocks.map((b, i) => {
      const key = b.id || i
      if (b.type === 'divider') return <hr key={key} />
      if (['h1', 'h2', 'h3'].includes(b.type)) return <h4 key={key}>{b.text}</h4>
      if (b.type === 'quote') return <blockquote key={key}>{b.text}</blockquote>
      return <p key={key} className={b.type === 'callout' ? 'notice' : ''}>{b.type === 'todo' ? (b.checked ? '☑ ' : '☐ ') : b.type === 'bullet' ? '• ' : ''}{b.text}</p>
    })}</section>}
  </div>
}
