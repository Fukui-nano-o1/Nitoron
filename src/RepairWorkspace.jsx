import React, { useEffect, useRef, useState } from 'react'
import { Dialog, download } from './ui.jsx'
import { safeUrl, snapshot } from './domain.js'
import { AttachmentList } from './Attachments.jsx'
import MachinePicker from './MachinePicker.jsx'
import MachineCardMedia from './MachineCardMedia.jsx'
import { resolveMachineTarget } from './machine-domain.js'
import RepairMachineView from './RepairMachineView.jsx'
import RepairPilot from './RepairPilot.jsx'
import { isPilotMachine, POWER_GUIDE } from './repair-pilot.mjs'
import { isRepairRecord, newRepairRecord, newFreeRepairRecord, repairLookup, searchRepairMachines } from './repair-workspace.mjs'
import RepairRecordInfo from './RepairRecordInfo.jsx'
import RepairManagement from './RepairManagement.jsx'
import RepairEntrySheet, { RepairContent } from './RepairEntry.jsx'
import { repairHeadline, repairMachineLabel } from './repair-entry.mjs'
import './repair-workspace.css'

export function RepairHome({ records, ready, save, onCreate }) {
  const [query, setQuery] = useState('')
  const pending = useRef(null), [error, setError] = useState('')
  const machines = searchRepairMachines(query)
  const repairs = records.filter(isRepairRecord).filter(r => !query.trim() || [r.title, r.meta?.issue, repairHeadline(r.meta?.repair), repairMachineLabel(r.meta?.repair), repairLookup(r.meta?.machineRef).partLabel].join(' ').normalize('NFKC').toLowerCase().includes(query.normalize('NFKC').toLowerCase()))
  const start = descriptor => {
    if (!pending.current || pending.current.meta.machineRef?.machineId !== descriptor.machineId) pending.current = newRepairRecord(descriptor)
    if (!onCreate(pending.current)) setError('保存できません。もう一度お試しください。')
  }
  // 登録のない機械：3Dなしで、修理の内容（機械・症状・確認・対処・結果）だけを記録する。
  const startFree = () => { if (!onCreate(newFreeRepairRecord(query))) setError('保存できません。もう一度お試しください。') }
  return <section className="repair-page" aria-label="機械の修理">
    <header className="repair-page-head"><h1>機械の修理</h1></header>
    <form className="repair-search" role="search" onSubmit={e => e.preventDefault()}><label><span className="sr-only">メーカー・型番</span><input type="search" placeholder="メーカー・型番" value={query} onChange={e => setQuery(e.target.value)} /></label><button className="repair-search-button" aria-label="機械を検索">探す</button></form>
    {error && <p className="notice error" role="alert">{error}</p>}
    <h2 className="repair-row-title">修理をはじめる</h2>
    <div className="repair-machine-grid">{machines.map(machine => {
      const ref = { machineId: machine.machineId, modelVersion: machine.modelVersion, partId: machine.rootPartId }
      return <article className="repair-machine-card" key={machine.machineId} onClick={event => { if (event.target.closest('a') && !event.metaKey && !event.ctrlKey) { event.preventDefault(); if (ready) start(machine) } }}>
        <MachineCardMedia target={resolveMachineTarget({ subject: 'machine_repair', machineRef: ref })} machineRef={ref} href={`#/repairs?model=${encodeURIComponent(machine.machineId)}`} />
        <div className="repair-machine-card-copy"><span>{machine.maker}</span><h3>{machine.model}</h3><button className="primary" disabled={!ready} onClick={() => start(machine)}>修理をはじめる</button></div>
      </article>
    })}</div>
    {!machines.length && <div className="repair-empty"><h3>3Dに対応する機械がありません</h3><p className="repair-empty-label">3Dなしでも、機械・症状・確認・対処・結果は記録できます。</p><div className="actions"><button className="primary" disabled={!ready} onClick={startFree}>{query.trim() ? `「${query.trim()}」の修理を記録する` : '登録のない機械の修理を記録する'}</button><button className="text-action" onClick={() => setQuery('')}>対応機種を見る</button></div></div>}
    {!!machines.length && <p className="repair-free-start"><button className="text-action" disabled={!ready} onClick={startFree}>登録のない機械の修理を記録する（3Dなし）</button></p>}
    <div className="repair-row-head"><h2>修理の記録</h2><span>{repairs.length}件</span></div>
    <div className="repair-history-list">{repairs.map(record => <a className="repair-history-row" key={record.id} href={`#/repair/${record.id}`}><div><strong>{record.title || repairLookup(record.meta.machineRef).descriptor?.name || repairMachineLabel(record.meta.repair) || '機械未確認'}</strong><span>{repairHeadline(record.meta.repair) || record.meta.issue || repairLookup(record.meta.machineRef).partLabel || '症状未記録'}</span></div><time>{record.date}</time><span aria-hidden="true">›</span></a>)}</div>
    {!repairs.length && <p className="repair-empty-label">記録はここに残ります</p>}
  </section>
}

function ReadMore({ title, text }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  const first = text.split('\n').find(line => line.trim()) || ''
  return <section className="repair-result-section"><h2>{title}</h2><p className="repair-result-excerpt">{first}</p><button className="text-action" onClick={() => setOpen(true)}>すべて見る</button>{open && <Dialog title={title} onClose={() => setOpen(false)}><p className="repair-preserve-lines">{text}</p></Dialog>}</section>
}

// 同じ詳細コンポーネントを本人の記録と公開済みスナップショットで共用する。
// 3Dは文字列の型番から推測せず、保存済みmachineRefだけで復元する。
export function RepairDetail({ record, onSave, save, readOnly = false, onBack, onShare, onBookmark, bookmarked, editHref, discussion, management, additionalMenu }) {
  const [sheet, setSheet] = useState(null), [viewerRevision, setViewerRevision] = useState(0), [error, setError] = useState('')
  const [entryFocus, setEntryFocus] = useState('symptom')
  const previousSheet = useRef(null)
  useEffect(() => { if (sheet === null && ['guide', 'parts'].includes(previousSheet.current)) setViewerRevision(value => value + 1); previousSheet.current = sheet }, [sheet])
  const resolved = repairLookup(record.meta.machineRef), known = !!resolved.descriptor
  const pilotMachine = isPilotMachine(record.meta)
  const symptom = repairHeadline(record.meta.repair) || record.meta.issue
  const canGuide = pilotMachine && (!symptom || record.meta.issue === POWER_GUIDE.label)
  const openEntry = focus => { setEntryFocus(focus); setSheet('entry') }
  const savePatch = patch => { const ok = onSave?.({ ...record, meta: { ...record.meta, ...patch } }); setError(ok ? '' : '保存できません。入力を保持しています。'); return ok }
  const beginGuide = () => {
    if (!record.meta.issue && !savePatch({ issue: POWER_GUIDE.label })) return
    setSheet('guide')
  }
  const sourceLinks = record.meta.sources || []
  return <article className="repair-page repair-detail" aria-label="修理の詳細" data-record-id={record.id}>
    <header className="repair-page-head"><div>{onBack ? <button className="text-action" onClick={onBack}>戻る</button> : <a className="text-action" href="#/repairs">修理の記録</a>}<h1>{resolved.descriptor?.name || repairMachineLabel(record.meta.repair) || record.title || '機械未確認'}</h1></div><button className="text-action" onClick={() => setSheet('more')}>その他</button></header>
    <div className="repair-detail-layout"><div className="repair-detail-main">
      <RepairMachineView key={[record.id, record.meta.machineRef?.machineId, record.meta.machineRef?.modelVersion, record.meta.machineRef?.partId, viewerRevision].join(':')} machineRef={record.meta.machineRef} />
      <div className="repair-target-row"><span>{resolved.partLabel || '部品未確認'}</span>{!readOnly && known && <button className="text-action" onClick={() => setSheet('parts')}>部品を選ぶ</button>}</div>
      <section className="repair-symptom-section"><div className="repair-row-head"><h2>修理の内容</h2>{!readOnly && <button className="text-action" onClick={() => openEntry('symptom')}>{symptom ? '変更' : '書く'}</button>}</div>
        <RepairContent repair={record.meta.repair} fallbackSymptom={record.meta.issue} /></section>
      {(record.meta.action || record.meta.result) && <section className="repair-legacy-section"><h2>案内からの記録</h2><ReadMore title="行ったこと" text={record.meta.action} /><ReadMore title="確認した結果" text={record.meta.result} /></section>}
      {!!sourceLinks.length && <button className="text-action repair-source-button" onClick={() => setSheet('sources')}>説明書・根拠（{sourceLinks.length}）</button>}
      {!!record.meta.attachments?.length && <AttachmentList attachments={record.meta.attachments} />}
      {error && <p className="notice error" role="alert">{error}</p>}
    </div><aside className="repair-action-panel">
      <div><strong>{resolved.descriptor?.model || repairMachineLabel(record.meta.repair) || '修理記録'}</strong><span>{symptom || '症状を確認する'}</span></div>
      {!readOnly ? <>{canGuide && <button className="primary" onClick={beginGuide}>症状を確認する</button>}<button className={canGuide ? 'secondary' : 'primary'} onClick={() => openEntry(symptom ? 'outcome' : 'symptom')}>{symptom ? '結果を残す' : '修理の内容を書く'}</button><button className={`repair-save-status${save?.error ? ' is-error' : ''}`} onClick={() => setSheet('save')}>{save?.error ? '未保存' : save?.status || '保存状態を確認'}</button></> : <>{editHref && <a className="primary" href={editHref}>記録を開く</a>}{onBookmark && <button className="secondary" aria-pressed={bookmarked} onClick={onBookmark}>{bookmarked ? '保存済み' : '保存'}</button>}</>}
    </aside></div>
    {discussion}
    {sheet === 'guide' && <RepairPilot meta={record.meta} onClose={() => setSheet(null)} onTransfer={meta => { const ok = onSave?.({ ...record, meta }); if (ok) setSheet(null); return ok }} />}
    {sheet === 'parts' && <MachinePicker value={record.meta.machineRef} onClose={() => setSheet(null)} onConfirm={ref => { if (savePatch({ machineRef: ref })) setSheet(null) }} />}
    {sheet === 'entry' && <RepairEntrySheet record={record} focus={entryFocus} onSave={onSave} onClose={() => setSheet(null)} />}
    {sheet === 'sources' && <Dialog title="説明書・根拠" onClose={() => setSheet(null)}>{sourceLinks.map(source => <p key={source.id}>{safeUrl(source.url) ? <a href={safeUrl(source.url)} target="_blank" rel="noopener noreferrer">{source.title || '資料を開く'}</a> : source.title || '資料未確認'}</p>)}</Dialog>}
    {sheet === 'save' && <Dialog title="保存状態" onClose={() => setSheet(null)}><p>{save?.error || save?.status || '保存状態を確認できません。'}</p>{save?.retry && <button className="primary" onClick={save.retry}>再試行</button>}<button className="text-action" onClick={() => download(`repair-${record.id}.json`, JSON.stringify(snapshot(record), null, 2), 'application/json')}>記録を書き出す</button></Dialog>}
    {sheet === 'more' && <Dialog title="その他" onClose={() => setSheet(null)}><div className="repair-menu"><button onClick={() => setSheet('record-info')}>記録の詳細</button>{management && <button onClick={() => setSheet('manage')}>公開・記録管理</button>}{additionalMenu}{onShare && <button onClick={onShare}>共有</button>}<button onClick={() => window.print()}>印刷・PDFに保存</button><button onClick={() => download(`repair-${record.id}.json`, JSON.stringify(snapshot(record), null, 2), 'application/json')}>記録を書き出す</button>{!!record.blocks?.some(b => b.text) && <details><summary>以前のメモ</summary>{record.blocks.filter(b => b.text).map(b => <p key={b.id} className="repair-preserve-lines">{b.text}</p>)}</details>}<button onClick={() => setSheet('about')}>この3Dについて</button></div></Dialog>}
    {sheet === 'record-info' && <Dialog title="記録の詳細" onClose={() => setSheet(null)}><RepairRecordInfo record={record} /></Dialog>}
    {sheet === 'manage' && <RepairManagement record={record} management={management} save={save} onClose={() => setSheet(null)} />}
    {sheet === 'about' && <Dialog title="この3Dについて" onClose={() => setSheet(null)}><p>部品位置を探すための参考モデルです。実寸・適合・整備上の分解順序は確認済みではありません。</p><p>案内は点検候補を示します。原因や修理完了を自動判定しません。</p></Dialog>}
  </article>
}
