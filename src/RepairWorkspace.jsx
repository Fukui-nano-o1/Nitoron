import React, { useEffect, useRef, useState } from 'react'
import { Dialog, download } from './ui.jsx'
import { safeUrl, snapshot } from './domain.js'
import { AttachmentList } from './Attachments.jsx'
import MachinePicker from './MachinePicker.jsx'
import RepairMachineView from './RepairMachineView.jsx'
import RepairPilot from './RepairPilot.jsx'
import { isPilotMachine, POWER_GUIDE } from './repair-pilot.mjs'
import { isRepairRecord, newRepairRecord, newFreeRepairRecord, repairLookup, searchRepairMachines } from './repair-workspace.mjs'
import RepairRecordInfo from './RepairRecordInfo.jsx'
import RepairManagement from './RepairManagement.jsx'
import RepairEntrySheet, { RepairContent } from './RepairEntry.jsx'
import { repairHeadline, repairMachineLabel } from './repair-entry.mjs'
import './repair-workspace.css'

// 結果の短い語。修理記録の行の副題に「症状 · 結果」として文字だけ足す（要素は増やさない）。
const OUTCOME_SHORT = { improved: '改善', unchanged: '変化なし', 'not-assessed': '未確認', consult: '相談' }

// 修理記録タブ（#/repairs）：h1＋件数、「新しい修理記録」、自分の修理記録の一覧。作成は #/repairs/new のシートで行う。
export function RepairHome({ records, ready, onCreate, sheetOpen = false, initialQuery = '', onSheetClose }) {
  const pending = useRef(null), [error, setError] = useState('')
  // 新しい順（date 降順、同日は records の並び＝更新順）。
  const repairs = records.filter(isRepairRecord).sort((a, b) => b.date.localeCompare(a.date))
  // 記録開始の前にシートを閉じる（#/repairs/new を #/repairs に置き換えてから #/repair/:id へ進むので、戻るでシートが再び開かない）。
  const start = descriptor => {
    if (!pending.current || pending.current.meta.machineRef?.machineId !== descriptor.machineId) pending.current = newRepairRecord(descriptor)
    onSheetClose?.()
    if (!onCreate(pending.current)) setError('保存できません。もう一度お試しください。')
  }
  // 登録のない機械：3Dなしで、修理の内容（機械・症状・確認・対処・結果）だけを記録する。型番から登録機種を推測しない。
  const startFree = text => { onSheetClose?.(); if (!onCreate(newFreeRepairRecord(text))) setError('保存できません。もう一度お試しください。') }
  return <section className="repair-page" aria-label="修理記録">
    <header className="repair-page-head"><div className="repair-page-title"><h1>修理記録</h1><span>{repairs.length}件</span></div><button className="primary" disabled={!ready} onClick={() => { location.hash = '/repairs/new' }}>新しい修理記録</button></header>
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="repair-history-list">{repairs.map(record => <a className="repair-history-row" key={record.id} href={`#/repair/${record.id}`}><div><strong>{record.title || repairLookup(record.meta.machineRef).descriptor?.name || repairMachineLabel(record.meta.repair) || '機械未確認'}</strong><span>{[repairHeadline(record.meta.repair) || record.meta.issue || (record.meta.machineRef ? repairLookup(record.meta.machineRef).partLabel : '') || '症状未記録', OUTCOME_SHORT[record.meta.repair?.outcome?.status]].filter(Boolean).join(' · ')}</span></div><time>{record.date}</time><span aria-hidden="true">›</span></a>)}</div>
    {!repairs.length && <p className="repair-empty-label">記録はここに残ります</p>}
    {sheetOpen && <NewRepairSheet key={initialQuery} ready={ready} initialQuery={initialQuery} onStart={start} onStartFree={startFree} onClose={onSheetClose} />}
  </section>
}

// 新しい修理記録シート（#/repairs/new?q=）：メーカー・型式の入力 → 一致する登録機（3Dあり）の行 → 登録のない機械として記録する行（常時）。
function NewRepairSheet({ ready, initialQuery, onStart, onStartFree, onClose }) {
  const [query, setQuery] = useState(initialQuery)
  const machines = searchRepairMachines(query)
  return <Dialog title="新しい修理記録" className="repair-note-sheet" onClose={onClose}>
    <input type="search" aria-label="メーカー・型式" placeholder="メーカー・型式" maxLength={200} value={query} onChange={e => setQuery(e.target.value)} autoFocus />
    <div className="repair-new-list">
      {machines.map(machine => <button key={machine.machineId} className="repair-new-row" disabled={!ready} onClick={() => onStart(machine)}><span>{machine.name}</span><small>3Dあり</small></button>)}
      <button className="repair-new-row" disabled={!ready} onClick={() => onStartFree(query)}><span>{query.trim() ? `「${query.trim()}」を登録のない機械として記録する（3Dなし）` : '登録のない機械の修理を記録する'}</span></button>
    </div>
  </Dialog>
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
    <header className="repair-page-head"><div>{onBack ? <button className="text-action" onClick={onBack}>戻る</button> : <a className="text-action" href="#/repairs">修理記録</a>}<h1>{resolved.descriptor?.name || repairMachineLabel(record.meta.repair) || record.title || '機械未確認'}</h1></div><button className="text-action" onClick={() => setSheet('more')}>その他</button></header>
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
