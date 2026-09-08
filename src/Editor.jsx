import React, { useState } from 'react'
import BlockEditor from './BlockEditor.jsx'
import RecordBody from './RecordBody.jsx'
import Cover from './Cover.jsx'
import Attachments from './Attachments.jsx'
import Extract from './Extract.jsx'
import { KINDS, PHASES, SECTIONS, METRICS, emptyMeta, today, uid, exportMarkdown } from './domain.js'
import { Field, Dialog, download } from './ui.jsx'

export default function Editor({ record, onChange, onPublish, onDelete, published, onUnpublish, onShare, onDerive, discussion, session, flush }) {
  const [tab, setTab] = useState('edit'), [confirmDelete, setConfirmDelete] = useState(false)
  const [uploading, setUploading] = useState(false)
  const m = record.meta
  const patch = update => onChange({ ...record, ...update })
  const meta = update => patch({ meta: { ...m, ...update } })
  const textInput = (key, label, placeholder = '', type = 'text') => <Field key={key} label={label}><input type={type} value={m[key]} onChange={e => meta({ [key]: e.target.value })} placeholder={placeholder} maxLength={type === 'text' ? 160 : undefined} /></Field>
  return <>
    <header className="document-toolbar">
      <a href="#/mine" className="back-link">自分の記録</a>
      <span className="document-type">{KINDS[m?.kind || 'memo']}</span>
      <div className="actions"><button className="quiet" onClick={() => download(`${record.title || '記録'}.md`, exportMarkdown(record), 'text/markdown')}>書き出す</button>
        <button className="primary" onClick={onPublish} disabled={!m || uploading}>{published ? '公開版を更新' : '公開する'}</button></div>
    </header>
    <div className="document-layout">
      <aside className="document-outline"><p>この記録</p>
        {m?.inputMode === 'sections' && <><a href="#document-summary" onClick={e => { e.preventDefault(); document.getElementById('document-summary')?.scrollIntoView({ behavior: 'smooth' }) }}>概要</a>
        {SECTIONS.map(([key, title]) => <a key={key} href={`#section-${key}`} onClick={e => { e.preventDefault(); document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: 'smooth' }) }}>{title}</a>)}</>}
        <div className="outline-bottom"><button className="quiet" onClick={() => setConfirmDelete(true)}>記録を削除</button></div>
      </aside>
      <article className="document">
        <div className="document-heading"><div className="eyebrow">{m ? '4H CLUB / FIELD RECORD' : 'FIELD NOTE'}</div>
          <div className="segmented"><button aria-pressed={tab === 'edit'} onClick={() => setTab('edit')}>書く</button><button aria-pressed={tab === 'read'} disabled={uploading} onClick={() => setTab('read')}>読む</button></div></div>
        {published && <div className="notice">公開版があります。ここでの変更は「公開版を更新」で反映します。<div className="actions"><button onClick={onShare}>リンクを共有</button><a href={`#/public/${record.id}`}>公開版を見る</a><button onClick={onUnpublish}>公開を停止</button></div></div>}
        {tab === 'read' ? <><RecordBody record={record} /><div className="actions print-hidden"><button className="secondary" onClick={() => window.print()}>印刷・PDFに保存</button></div>{discussion}</> : <>
          <input className="title-input" aria-label="記録のタイトル" placeholder={m ? '発表のタイトル' : 'メモのタイトル'} maxLength={200} value={record.title} onChange={e => patch({ title: e.target.value })} />
          {!m ? <>
            <div className="fields two"><Field label="種類"><select value={record.type} onChange={e => patch({ type: e.target.value })}><option>メモ</option><option>アイデア</option><option>タスク</option></select></Field>
              <Field label="カテゴリ"><input value={record.category === '未分類' ? '' : record.category} onChange={e => patch({ category: e.target.value || '未分類' })} /></Field></div>
            <BlockEditor blocks={record.blocks} onChange={blocks => patch({ blocks })} />
            <Extract record={record} onChange={onChange} />
            <button className="secondary" onClick={() => meta(emptyMeta())}>このメモを経営発表にする</button>
          </> : <>
            <Attachments record={record} session={session} flush={flush} onChange={onChange} onBusy={setUploading} />
            <Extract record={record} onChange={onChange} note={m.inputMode === 'sections' ? '「補足メモ」' : '本文'} />
            <details className="details cover-settings"><summary>外部の写真URLを使う</summary>
              {m.coverUrl && <Cover record={record} className="editor-cover" />}
              <Field label="写真のURL" help="自分の写真など、公開してよい画像のURLを入力。空欄でも記録できます。"><input type="url" value={m.coverUrl || ''} onChange={e => meta({ coverUrl: e.target.value })} placeholder="https://" /></Field>
              {m.coverUrl && <button className="quiet" onClick={() => meta({ coverUrl: '' })}>写真を外す</button>}
            </details>
            <div className="segmented input-mode-switch"><button aria-pressed={m.inputMode !== 'sections'} onClick={() => meta({ inputMode: 'free' })}>フリー入力</button><button aria-pressed={m.inputMode === 'sections'} onClick={() => meta({ inputMode: 'sections' })}>項目で分ける</button></div>
            {m.inputMode !== 'sections' ? <>
              <p className="hint">思いつくまま自由に書けます。切り替えても、書いた内容は消えません。</p>
              <BlockEditor blocks={record.blocks} onChange={blocks => patch({ blocks })} />
              {m.origin && <p className="source-line">参考にした記録：{m.origin.public ? <a href={`#/public/${m.origin.id}`}>{m.origin.title}</a> : m.origin.title}</p>}
            </> : <>
            <section id="document-summary" className="editor-section"><Field label="要約" help="読む人が、試したことと分かったことを最初につかめるように。"><textarea rows={3} maxLength={2000} value={m.summary} onChange={e => meta({ summary: e.target.value })} placeholder="何を試し、何が分かったか。これから試す記録なら、その目的を。" /></Field>
              <div className="fields two">{textInput('author', '発表者名')}{textInput('crop', '作物', '例：ブロッコリー')}</div>
              <details className="details"><summary>地域・所属・対象期間などの条件</summary><div className="fields two">
                {textInput('club', '所属クラブ')}{textInput('region', '地域', '都道府県・市町村')}{textInput('variety', '品種')}
                <Field label="対象面積（a）"><input type="number" min="0.01" step="any" value={m.areaA} onChange={e => meta({ areaA: e.target.value })} placeholder="10" /></Field>
                {textInput('start', '対象期間の開始', '', 'date')}{textInput('end', '対象期間の終了', '', 'date')}
              </div><Field label="比較するときに必要な条件"><textarea rows={2} value={m.conditions} onChange={e => meta({ conditions: e.target.value })} placeholder="土壌、天候、前作、設備、経費に含めた範囲など" /></Field></details>
            </section>
            {m.origin && <p className="source-line">参考にした記録：{m.origin.public ? <a href={`#/public/${m.origin.id}`}>{m.origin.title}</a> : m.origin.title}</p>}
            {m.kind === 'challenge' && <section className="editor-section challenge-plan"><div className="section-heading"><span className="section-number">PLAN</span><h2>挑戦の計画</h2></div>
              <div className="fields two"><Field label="進捗"><select value={m.stage} onChange={e => meta({ stage: e.target.value })}>{PHASES.map(p => <option key={p}>{p}</option>)}</select></Field>{textInput('deadline', '振り返る日', '', 'date')}</div>
              {textInput('target', '目標', '何を、どこまで変えるか')}{textInput('criterion', '確かめる方法・判定基準', '何を測り、何と比較するか')}
            </section>}
            {SECTIONS.map(([key, label, placeholder], index) => <section id={`section-${key}`} className="editor-section" key={key}>
              <div className="section-heading"><span className="section-number">{String(index + 1).padStart(2, '0')}</span><h2>{label}</h2>{key === 'hypothesis' && <span className="state-label">未検証の見立て</span>}{key === 'interpretation' && <span className="state-label">事実からの解釈</span>}</div>
              <textarea className="section-input" aria-label={label} rows={3} maxLength={20000} value={m[key]} onChange={e => meta({ [key]: e.target.value })} placeholder={placeholder} />
            </section>)}
            <section className="editor-section"><div className="section-heading"><span className="section-number">DATA</span><h2>観測した事実</h2></div>
              <p className="hint">見たこと・測ったことを、日付と根拠と一緒に残す。</p>
              {m.observations.map((o, i) => <div className="observation-input" key={o.id}>
                <div className="observation-top"><span>観測 {i + 1}</span><input aria-label={`観測${i + 1}の日付`} type="date" value={o.date} onChange={e => meta({ observations: m.observations.map(x => x.id === o.id ? { ...x, date: e.target.value } : x) })} />
                  <button className="quiet" onClick={() => { if (!o.fact || window.confirm('この観測を削除しますか？')) meta({ observations: m.observations.filter(x => x.id !== o.id) }) }}>削除</button></div>
                {[['fact', '観測した事実'], ['conditions', '観測条件'], ['evidence', '根拠・記録の場所']].map(([key, label]) => <Field label={label} key={key}><textarea rows={key === 'fact' ? 2 : 1} value={o[key]} onChange={e => meta({ observations: m.observations.map(x => x.id === o.id ? { ...x, [key]: e.target.value } : x) })} /></Field>)}
              </div>)}
              <button className="secondary" onClick={() => meta({ observations: [...m.observations, { id: uid(), date: today(), fact: '', conditions: '', evidence: '' }] })}>観測を追加</button>
            </section>
            <section className="editor-section"><div className="section-heading"><span className="section-number">NUMBERS</span><h2>経営の数字</h2></div><p className="hint">すべて同じ対象期間・面積で記録。分からない項目は空欄に。</p>
              <div className="fields two">{METRICS.map(([key, label, unit]) => <Field key={key} label={`${label}（${unit}）`}><input type="number" min="0" step="any" value={m[key]} onChange={e => meta({ [key]: e.target.value })} placeholder="未記録" /></Field>)}</div>
            </section>
            <details className="details extra-content"><summary>出典・資料と補足</summary>
              {m.sources.map((source, i) => <div className="source-input" key={source.id}>
                <Field label={`資料 ${i + 1} の名前`}><input value={source.title} onChange={e => meta({ sources: m.sources.map(s => s.id === source.id ? { ...s, title: e.target.value } : s) })} /></Field>
                <Field label="URL"><input type="url" value={source.url} onChange={e => meta({ sources: m.sources.map(s => s.id === source.id ? { ...s, url: e.target.value } : s) })} placeholder="https://" /></Field>
                <Field label="資料の日付"><input type="date" value={source.date} onChange={e => meta({ sources: m.sources.map(s => s.id === source.id ? { ...s, date: e.target.value } : s) })} /></Field>
                <button className="quiet" onClick={() => meta({ sources: m.sources.filter(s => s.id !== source.id) })}>資料を外す</button></div>)}
              <button className="secondary" onClick={() => meta({ sources: [...m.sources, { id: uid(), title: '', url: '', date: '' }] })}>出典・資料を追加</button>
              <h3>補足メモ</h3><BlockEditor blocks={record.blocks} onChange={blocks => patch({ blocks })} />
            </details>
            </>}
          </>}
        </>}
      </article>
    </div>
    {confirmDelete && <Dialog title="記録を削除" onClose={() => setConfirmDelete(false)}><p>「{record.title || '無題'}」を削除します。元に戻せません。公開したことのある記録では、指摘も削除されます。</p>{published ? <p>先に公開を停止してください。必要な内容は書き出して保管してください。</p> : <button className="danger" onClick={async () => { try { await onDelete(); setConfirmDelete(false) } catch { /* Parent shows the failure; keep the confirmation open. */ } }}>削除する</button>}</Dialog>}
  </>
}
