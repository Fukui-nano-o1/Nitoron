import React, { useMemo, useState } from 'react'
import BlockEditor from './BlockEditor.jsx'
import Cover from './Cover.jsx'
import Attachments from './Attachments.jsx'
import PublicRecord from './PublicRecord.jsx'
import Icon from './Icon.jsx'
import { KINDS, PHASES, SECTIONS, METRICS, emptyMeta, today, uid, exportMarkdown, snapshot, publicationProblems, publicationAdvice, publishedDiffers } from './domain.js'
import { Field, Dialog, ErrorNotice, download } from './ui.jsx'

export const STEPS = [['basics', '基本情報'], ['content', '内容・資料'], ['review', '確認・公開']]
// 保存状態チップ。端末保存成功・クラウド同期失敗＝「端末に保存・同期待ち」、端末保存にも失敗＝「保存できていません」。再試行はどの段階からも押せる。
export function SaveChip({ save }) {
  const trouble = save.sync.cacheFailed || (save.session && save.sync.pending > 0) || !!save.error
  return <span className={`save-chip${trouble ? ' trouble' : ''}`} role="status"><span>{save.status}</span>{trouble && <button className="quiet" onClick={save.retry}>再試行</button>}</span>
}
// 記録の編集。発表は「基本情報 → 内容・資料 → 確認・公開」の3段階。段階を移動しても自動保存は続く。
export default function Editor({ record, step, onStep, onChange, session, flush, save, published, publication, onPublish, publishing, publishResult, onUnpublish, onShare, onDelete, onAccount, discussion }) {
  const [confirmDelete, setConfirmDelete] = useState(false), [uploading, setUploading] = useState(false)
  const m = record.meta
  const patch = update => onChange({ ...record, ...update })
  const meta = update => patch({ meta: { ...m, ...update } })
  const textInput = (key, label, placeholder = '', type = 'text') => <Field key={key} label={label}><input type={type} value={m[key]} onChange={e => meta({ [key]: e.target.value })} placeholder={placeholder} maxLength={type === 'text' ? 160 : undefined} /></Field>
  const index = Math.max(0, STEPS.findIndex(([key]) => key === step))
  const toolbar = <header className="document-toolbar">
    <a href="#/mine" className="back-link">自分の実践</a>
    <span className="document-type">{KINDS[m?.kind || 'memo']}</span>
    <SaveChip save={save} />
    <div className="actions"><button className="quiet" onClick={() => download(`${record.title || '記録'}.md`, exportMarkdown(record), 'text/markdown')}>書き出す</button></div>
  </header>
  const deleteDialog = confirmDelete && <Dialog title="記録を削除" onClose={() => setConfirmDelete(false)}><p>「{record.title || '無題'}」を削除します。元に戻せません。公開したことのある記録では、指摘も削除されます。</p>{published ? <p>先に公開を停止してください。必要な内容は書き出して保管してください。</p> : <button className="danger" onClick={async () => { try { await onDelete(); setConfirmDelete(false) } catch { /* Parent shows the failure; keep the confirmation open. */ } }}>削除する</button>}</Dialog>
  if (!m) return <>{toolbar}<div className="document-layout"><article className="document">
    <input className="title-input" aria-label="記録のタイトル" placeholder="メモのタイトル" maxLength={200} value={record.title} onChange={e => patch({ title: e.target.value })} />
    <div className="fields two"><Field label="種類"><select value={record.type} onChange={e => patch({ type: e.target.value })}><option>メモ</option><option>アイデア</option><option>タスク</option></select></Field>
      <Field label="カテゴリ"><input value={record.category === '未分類' ? '' : record.category} onChange={e => patch({ category: e.target.value || '未分類' })} /></Field></div>
    <BlockEditor blocks={record.blocks} onChange={blocks => patch({ blocks })} />
    <div className="actions"><button className="secondary" onClick={() => meta(emptyMeta())}>このメモを経営発表にする</button><button className="quiet" onClick={() => setConfirmDelete(true)}>記録を削除</button></div>
  </article></div>{deleteDialog}</>

  const problems = publicationProblems(record), advice = publicationAdvice(record)
  const verified = !!session?.user && !session.user.is_anonymous && !!session.user.email_confirmed_at
  // 公開を止める条件：入力検査・認証・クラウド保存完了。推奨項目は別に示す。
  const blockers = [
    ...problems.map(text => ({ text })),
    ...(!session ? [{ text: 'ログインしていません。公開にはメールアドレスを確認したアカウントが必要です。', action: onAccount, label: '登録・ログイン' }]
      : !verified ? [{ text: 'メールアドレスの確認が済んでいません。確認してから公開できます。', action: onAccount, label: 'アカウントを確認' }] : []),
    ...(save.sync.cacheFailed ? [{ text: '端末に保存できていません。空き容量を確認して再試行してください。', action: save.retry, label: '再試行' }]
      : session && save.sync.pending > 0 ? [{ text: '下書きのクラウド保存が完了していません（同期待ち）。再試行して保存を完了してから公開できます。', action: save.retry, label: '再試行' }] : []),
  ]
  const ready = blockers.length === 0 && !uploading
  const preview = useMemo(() => ({ ...snapshot(record), publication: { id: record.id, owner: session?.user.id || null, publishedAt: publication?.row?.published_at, updatedAt: publication?.row?.updated_at || new Date().toISOString().slice(0, 10), isPublic: published } }), [record, session?.user.id, publication?.row?.updated_at, published])
  const differs = publication?.row?.snapshot ? publishedDiffers(record, publication.row.snapshot) : null
  const next = () => onStep(STEPS[index + 1][0]), prev = () => onStep(STEPS[index - 1][0])
  return <>
    {toolbar}
    <nav className="stepper print-hidden" aria-label="入力の段階">{STEPS.map(([key, label], i) => <button key={key} aria-current={key === step ? 'step' : undefined} onClick={() => onStep(key)}><span className="step-number">{i + 1}</span><span>{label}</span></button>)}</nav>
    <div className="document-layout">
      <article className={`document step-${step}`}>
        {step === 'basics' && <>
          <input className="title-input" aria-label="記録のタイトル" placeholder="発表のタイトル" maxLength={200} value={record.title} onChange={e => patch({ title: e.target.value })} />
          <Field label="分類" help="切り替えても入力済みの内容は消えません。挑戦にすると計画の項目が加わります。"><select value={m.kind} onChange={e => meta({ kind: e.target.value })}>{Object.entries(KINDS).filter(([key]) => key !== 'memo').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
          <div className="fields two">{textInput('crop', '作物', '例：ブロッコリー')}{textInput('region', '地域', '都道府県・市町村')}</div>
          <div className="fields two">{textInput('author', '発表者名')}{textInput('club', '所属クラブ')}</div>
          <div className="fields two">{textInput('variety', '品種')}<Field label="対象面積（a）"><input type="number" min="0.01" step="any" value={m.areaA} onChange={e => meta({ areaA: e.target.value })} placeholder="10" /></Field></div>
          <div className="fields two">{textInput('start', '対象期間の開始', '', 'date')}{textInput('end', '対象期間の終了', '', 'date')}</div>
          {m.origin && <p className="source-line">参考にした記録：{m.origin.public ? <a href={`#/public/${m.origin.id}`}>{m.origin.title}</a> : m.origin.title}</p>}
          {m.kind === 'challenge' && <section className="editor-section challenge-plan"><div className="section-heading"><span className="section-number">PLAN</span><h2>挑戦の計画</h2><span className="state-label">推奨</span></div>
            <div className="fields two"><Field label="進捗"><select value={m.stage} onChange={e => meta({ stage: e.target.value })}>{PHASES.map(p => <option key={p}>{p}</option>)}</select></Field>{textInput('deadline', '振り返る日', '', 'date')}</div>
            {textInput('target', '目標', '何を、どこまで変えるか')}{textInput('criterion', '確かめる方法・判定基準', '何を測り、何と比較するか')}
          </section>}
          <section className="editor-section"><div className="section-heading"><h2>カバー写真</h2></div>
            {(m.coverUrl || m.attachments?.some(a => a.type.startsWith('image/'))) ? <Cover record={record} className="editor-cover" /> : <p className="hint">写真は「内容・資料」で添付すると、先頭の1枚がカバーになります。</p>}
            <details className="details cover-settings"><summary>外部の写真URLを使う</summary>
              <Field label="写真のURL" help="自分の写真など、公開してよい画像のURLを入力。空欄でも記録できます。"><input type="url" value={m.coverUrl || ''} onChange={e => meta({ coverUrl: e.target.value })} placeholder="https://" /></Field>
              {m.coverUrl && <button className="quiet" onClick={() => meta({ coverUrl: '' })}>写真を外す</button>}
            </details></section>
        </>}
        {step === 'content' && <>
          <div className="segmented input-mode-switch"><button aria-pressed={m.inputMode !== 'sections'} onClick={() => meta({ inputMode: 'free' })}>フリー入力</button><button aria-pressed={m.inputMode === 'sections'} onClick={() => meta({ inputMode: 'sections' })}>項目で分ける</button></div>
          <p className="hint">切り替えても、書いた文章・数字・添付は消えません。元に戻せば表示も戻ります。</p>
          {m.origin && <p className="source-line">参考にした記録：{m.origin.public ? <a href={`#/public/${m.origin.id}`}>{m.origin.title}</a> : m.origin.title}</p>}
          <section id="document-summary" className="editor-section"><Field label="要約" help="読む人が、試したことと分かったことを最初につかめるように。"><textarea rows={3} maxLength={2000} value={m.summary} onChange={e => meta({ summary: e.target.value })} placeholder="何を試し、何が分かったか。これから試す記録なら、その目的を。" /></Field></section>
          {m.inputMode !== 'sections' ? <section className="editor-section"><div className="section-heading"><h2>本文</h2></div><BlockEditor blocks={record.blocks} onChange={blocks => patch({ blocks })} /></section>
            : SECTIONS.map(([key, label, placeholder], i) => <section id={`section-${key}`} className="editor-section" key={key}>
              <div className="section-heading"><span className="section-number">{String(i + 1).padStart(2, '0')}</span><h2>{label}</h2>{key === 'hypothesis' && <span className="state-label">未検証の見立て</span>}{key === 'interpretation' && <span className="state-label">事実からの解釈</span>}</div>
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
            <Field label="比較するときに必要な条件"><textarea rows={2} value={m.conditions} onChange={e => meta({ conditions: e.target.value })} placeholder="土壌、天候、前作、設備、経費に含めた範囲など" /></Field>
          </section>
          <Attachments record={record} session={session} flush={flush} onChange={onChange} onBusy={setUploading} />
          <details className="details extra-content"><summary>出典・資料{m.inputMode === 'sections' ? 'と補足' : ''}</summary>
            {m.sources.map((source, i) => <div className="source-input" key={source.id}>
              <Field label={`資料 ${i + 1} の名前`}><input value={source.title} onChange={e => meta({ sources: m.sources.map(s => s.id === source.id ? { ...s, title: e.target.value } : s) })} /></Field>
              <Field label="URL"><input type="url" value={source.url} onChange={e => meta({ sources: m.sources.map(s => s.id === source.id ? { ...s, url: e.target.value } : s) })} placeholder="https://" /></Field>
              <Field label="資料の日付"><input type="date" value={source.date} onChange={e => meta({ sources: m.sources.map(s => s.id === source.id ? { ...s, date: e.target.value } : s) })} /></Field>
              <button className="quiet" onClick={() => meta({ sources: m.sources.filter(s => s.id !== source.id) })}>資料を外す</button></div>)}
            <button className="secondary" onClick={() => meta({ sources: [...m.sources, { id: uid(), title: '', url: '', date: '' }] })}>出典・資料を追加</button>
            {m.inputMode === 'sections' && <><h3>補足メモ</h3><BlockEditor blocks={record.blocks} onChange={blocks => patch({ blocks })} /></>}
          </details>
        </>}
        {step === 'review' && <>
          <section className="review-panel">
            <h2>{published ? '公開中' : '未公開'}</h2>
            {published && publication && <p className="hint">{publication.loading ? '公開版を確認中…' : publication.error ? <><span className="diff-unknown">公開版を取得できませんでした。</span> <button className="quiet" onClick={publication.retry}>再試行</button></> : publication.row ? <>公開版の更新：{publication.row.updated_at.slice(0, 10)} · {differs ? <strong className="diff-yes">公開版と異なる変更があります。「公開版を更新」で反映します。</strong> : '公開版と同じ内容です。'}</> : '公開版が見つかりません。'}</p>}
            {publishResult?.ok && <div className="notice success" role="status"><strong>公開しました。</strong>リンクから誰でも読めます。<div className="actions"><a className="secondary" href={`#/public/${record.id}`}>公開版を見る</a><button className="secondary" onClick={onShare}>リンクを共有</button></div></div>}
            {publishResult && !publishResult.ok && <ErrorNotice>{publishResult.message}</ErrorNotice>}
            {blockers.length ? <div className="readiness blockers"><h3>公開できない理由</h3><ul>{blockers.map((b, i) => <li key={i}>{b.text}{b.action && <button className="quiet" onClick={b.action}>{b.label}</button>}</li>)}</ul></div>
              : <p className="readiness ok"><Icon name="check" size={16} />公開できます。{published ? '内容を確認して「公開版を更新」を押してください。' : '内容を確認して「公開する」を押してください。'}</p>}
            {advice.length > 0 && <div className="readiness advice"><h3>推奨（公開は止めません）</h3><ul>{advice.map((a, i) => <li key={i}>{a}</li>)}</ul></div>}
            <div className="actions review-actions">
              <button className="primary" disabled={!ready || publishing} onClick={onPublish}>{publishing ? '公開しています…' : published ? '公開版を更新' : 'この内容で公開する'}</button>
              {published && <><a className="secondary" href={`#/public/${record.id}`}>公開版を見る</a><button className="secondary" onClick={onShare}>リンクを共有</button><button className="text-action" onClick={onUnpublish}>公開を停止</button></>}
            </div>
            <p className="hint">公開すると、本文・名前・地域・数字・写真・添付資料・資料リンクがログインなしで誰でも読めます。個人情報や他人の未公開情報が含まれていないか確認してください。</p>
          </section>
          <div className="preview-frame"><div className="preview-label">プレビュー：公開したときの見え方（この内容がそのまま公開されます）</div><PublicRecord record={preview} preview /></div>
          {discussion}
          <div className="actions"><button className="quiet" onClick={() => setConfirmDelete(true)}>記録を削除</button></div>
        </>}
      </article>
    </div>
    <div className="step-bar print-hidden">{index > 0 ? <button className="secondary" onClick={prev}><Icon name="left" size={14} />{STEPS[index - 1][1]}</button> : <span />}
      {index < STEPS.length - 1 ? <button className="primary" onClick={next}>次へ：{STEPS[index + 1][1]}<Icon name="right" size={14} /></button> : <button className="primary" disabled={!ready || publishing} onClick={onPublish}>{publishing ? '公開しています…' : published ? '公開版を更新' : '公開する'}</button>}</div>
    {deleteDialog}
  </>
}
