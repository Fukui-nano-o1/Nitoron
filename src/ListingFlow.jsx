import React, { lazy, Suspense, useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import Cover from './Cover.jsx'
import Attachments from './Attachments.jsx'
import BlockEditor from './BlockEditor.jsx'
import { Field, Dialog, ErrorNotice } from './ui.jsx'
import { KINDS, SECTIONS, publicSnapshot, publicationKey, publicationProblems, publishedDiffers } from './domain.js'
import { LISTING_STEPS, LISTING_PHASES, listingStepProblem } from './listing-flow.js'
import { MACHINE_CATEGORIES } from './search.js'
import { isRepairRecord } from './repair-workspace.mjs'
import RepairRecordInfo from './RepairRecordInfo.jsx'
const PublicRecord = lazy(() => import('./PublicRecord.jsx'))
const RepairEntrySheet = lazy(() => import('./RepairEntry.jsx'))

const KIND_OPTIONS = [
  ['presentation', '経営発表', '実践したことや、経営の成果', 'book'],
  ['trouble', 'カタログ', '機械の特徴や、参考になる資料', 'file'],
  ['challenge', '挑戦', 'これから試すことや、振り返り', 'flag'],
  ['learning', '学習ノート', '調べたことや、日々の気づき', 'pencil'],
]
const COPY = {
  kind: ['どんな記録を掲載しますか？', 'いちばん近いものを選びましょう。あとから変更できます。'],
  details: ['記録の基本情報を教えてください', 'わかる項目だけで大丈夫です。あとから追加できます。'],
  photos: ['写真で、記録を伝えましょう', '先頭の写真がカバーになります。写真や資料は、あとからでも追加できます。'],
  title: ['タイトルをつけましょう', '何についての記録か、ひと目で伝わる名前にしましょう。'],
  description: ['伝えたいことを書きましょう', '取り組んだことや、分かったことを自分の言葉で。'],
  review: ['掲載前に、最後の確認です', '写真や説明の見え方を確かめましょう。掲載後も編集できます。'],
}

export default function ListingFlow({ record, step, onStep, onChange, persisted, save, session, flush, known, published, publication, publishing, onPublish, onAccount }) {
  const [uploading, setUploading] = useState(false), [leaving, setLeaving] = useState(false)
  const [error, setError] = useState(''), [checkedKey, setCheckedKey] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false), [repairOpen, setRepairOpen] = useState(false)
  const [completion, setCompletion] = useState(null)
  const heading = useRef(null), submitLock = useRef(false), alive = useRef(true)
  const repair = isRepairRecord(record), m = record.meta
  const index = LISTING_STEPS.indexOf(step), phase = LISTING_PHASES.findIndex(p => p.steps.includes(step))
  const shown = publicSnapshot(record), shownKey = publicationKey(shown)
  const problems = publicationProblems(record)
  const busy = uploading || publishing || leaving
  const verified = !!session?.user && !session.user.is_anonymous && !!session.user.email_confirmed_at
  const unsaved = !!save.error || save.sync.cacheFailed || save.sync.pending > 0
  const confirmed = checkedKey === shownKey
  const blocked = busy || !known || !verified || unsaved || problems.length > 0 || !confirmed
  const returnHref = repair ? `#/repair/${record.id}` : '#/mine'
  const patch = update => onChange({ ...record, ...update })
  const meta = update => patch({ meta: { ...m, ...update } })
  const differs = publication?.row?.snapshot ? publishedDiffers(record, publication.row.snapshot) : null
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => { setError(''); heading.current?.focus({ preventScroll: true }) }, [step, completion])
  useEffect(() => {
    if (!busy) return
    const prevent = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', prevent)
    return () => window.removeEventListener('beforeunload', prevent)
  }, [busy])
  const move = target => { if (!busy) onStep(target) }
  const next = () => {
    const problem = listingStepProblem(record, step)
    if (problem) { setError(problem); return }
    if (save.sync.cacheFailed || !persisted && !onChange(record)) { setError('下書きを保存できません。保存を再試行してください。'); return }
    move(LISTING_STEPS[index + 1])
  }
  const saveAndGo = async href => {
    if (busy || submitLock.current) return
    setLeaving(true); setError('')
    try {
      if (!persisted && !onChange(record) || !await flush()) throw new Error('保存を完了できませんでした。接続を確認して、もう一度お試しください。')
      if (alive.current) location.hash = href
    } catch (e) { if (alive.current) setError(e.message) }
    finally { if (alive.current) setLeaving(false) }
  }
  const publish = async () => {
    if (blocked || submitLock.current) return
    submitLock.current = true; setError('')
    try {
      const result = await onPublish(shownKey)
      if (!alive.current) return
      if (!result?.ok) { setError(result?.message || '掲載できませんでした。もう一度お試しください。'); return }
      setCompletion({ record: shown, updated: published })
    } catch (e) { if (alive.current) setError(e.message || '掲載できませんでした。もう一度お試しください。') } finally { submitLock.current = false }
  }
  const input = (key, label, placeholder = '', type = 'text') => <Field label={label} key={key}><input type={type} value={m[key] || ''} onChange={e => meta({ [key]: e.target.value })} placeholder={placeholder} maxLength={type === 'text' ? 160 : undefined} /></Field>
  const card = value => <div className="listing-preview-card"><Cover record={value} eager /><div><strong>{value.title || 'タイトル未入力'}</strong><p>{[value.meta?.region, value.meta?.crop].filter(Boolean).join(' · ') || (repair ? '修理記録' : KINDS[value.meta?.kind])}</p>{value.meta?.summary && <p className="listing-card-summary">{value.meta.summary}</p>}</div></div>

  return <div className={`listing-flow${completion ? ' is-complete' : ''}`}>
    <header className="listing-header"><span className="listing-brand">nitoron<span>.</span></span><div className="listing-header-actions">
      {!completion && <><span className={`listing-save-state${unsaved ? ' pending' : ''}`} role="status">{persisted ? save.status : '下書きを作成中'}</span><button className="listing-exit" disabled={busy} onClick={() => saveAndGo(returnHref)}>{leaving ? '保存しています…' : '保存して終了'}</button></>}
      {completion && <a className="listing-exit" href={returnHref}>記録へ戻る</a>}
    </div></header>
    {completion ? <section className="listing-complete">
      <div className="listing-success-mark"><Icon name="check" size={42} /></div>
      <h1 ref={heading} tabIndex={-1}>{completion.updated ? '掲載内容を更新しました' : '掲載が完了しました！'}</h1>
      <p>あなたの記録を、Nitoronに掲載しました。</p>
      {card(completion.record)}
      <a className="listing-primary" href={`#/public/${record.id}`}>掲載ページを見る<Icon name="right" size={17} /></a>
      <a className="listing-text-button" href={repair ? `#/repair/${record.id}` : `#/record/${record.id}/content`}>記録を編集する</a>
    </section> : <>
      <section className={`listing-stage listing-stage-${step}`} key={step} aria-labelledby="listing-heading">
        {step === 'intro' ? <div className="listing-intro"><div><p className="listing-eyebrow">NITORONに掲載</p><h1 id="listing-heading" ref={heading} tabIndex={-1}>あなたの記録を、<br />次の誰かの<br className="listing-desktop-break" />ヒントに。</h1><p className="listing-intro-copy">掲載まで、かんたん3ステップ。<br />自分のペースで、少しずつ進めましょう。</p></div>
          <ol className="listing-intro-phases">{LISTING_PHASES.map((p, i) => <li key={p.title}><span className="listing-phase-number">{i + 1}</span><div><h2>{p.title}</h2><p>{p.description}</p></div><span className={`listing-phase-art art-${i}`}><Icon name={p.icon} size={40} /></span></li>)}</ol>
        </div> : <><div className="listing-stage-heading"><p className="listing-eyebrow">ステップ {phase + 1} / 3 · {['基本情報', '写真と説明', '掲載の準備'][phase]}</p><h1 id="listing-heading" ref={heading} tabIndex={-1}>{COPY[step][0]}</h1><p>{COPY[step][1]}</p></div>
          <fieldset className="listing-inputs" disabled={busy}>
            {step === 'kind' && (repair ? <div className="listing-repair-kind"><Icon name="wrench" size={36} /><h2>修理記録</h2><p>機械の情報・症状・対処・結果を掲載します。</p></div> : <div className="listing-kind-grid" role="group" aria-label="記録の種類">{KIND_OPTIONS.map(([key, label, description, icon]) => <button key={key} className={`listing-kind-option${m.kind === key ? ' selected' : ''}`} aria-pressed={m.kind === key} onClick={() => meta({ kind: key })}><Icon name={icon} size={32} /><strong>{label}</strong><span>{description}</span></button>)}</div>)}
            {step === 'details' && <div className="listing-fields">
              {repair || m.kind === 'trouble' ? <Field label="機械の分類"><select aria-label="機械の分類" value={m.crop} onChange={e => meta({ crop: e.target.value })}><option value="">まだ選ばない</option>{m.crop && !MACHINE_CATEGORIES.includes(m.crop) && <option>{m.crop}</option>}{MACHINE_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></Field> : input('crop', '作物', '例：ブロッコリー')}
              {input('region', '地域', '例：福井県福井市')}{input('author', '掲載者名', '掲載ページに表示する名前')}
              <details className="listing-details"><summary>所属・対象期間などを追加</summary><div className="listing-fields">{input('club', '所属')}{!repair && input('variety', '品種')}<div className="fields two">{input('start', '対象期間の開始', '', 'date')}{input('end', '対象期間の終了', '', 'date')}</div>{!repair && <Field label="対象面積（a）"><input type="number" min="0.01" step="any" value={m.areaA} onChange={e => meta({ areaA: e.target.value })} /></Field>}</div></details>
            </div>}
            {step === 'photos' && <><Attachments record={record} session={session} flush={flush} onChange={onChange} onBusy={setUploading} />
              <details className="listing-details"><summary>写真のURLを使う</summary><Field label="写真のURL"><input type="url" placeholder="https://" value={m.coverUrl || ''} onChange={e => meta({ coverUrl: e.target.value })} /></Field>{m.coverUrl && <Cover record={record} className="listing-external-cover" />}</details><p className="listing-hint">写真なしでも次へ進めます。</p></>}
            {step === 'title' && <><label className="listing-title-label" htmlFor="listing-title">記録のタイトル</label><textarea id="listing-title" className="listing-title-input" rows={3} maxLength={200} value={record.title} onChange={e => patch({ title: e.target.value })} placeholder={repair ? '例：トラクタの始動不良を確認した記録' : '例：ブロッコリーの収穫作業を見直して分かったこと'} aria-describedby="listing-title-count" aria-invalid={!!error} /><p id="listing-title-count" className="listing-counter">{record.title.length} / 200</p></>}
            {step === 'description' && <div className="listing-fields"><Field label="概要" help="一覧や掲載ページで、最初に伝えたいこと。"><textarea rows={5} maxLength={2000} value={m.summary} onChange={e => meta({ summary: e.target.value })} placeholder="どんなことをして、何が分かりましたか？" /></Field>
              {repair ? <><RepairRecordInfo record={record} /><button className="listing-secondary" onClick={() => setRepairOpen(true)}>修理の内容を編集</button></> : m.inputMode === 'sections' ? <details className="listing-details"><summary>本文を確認・編集</summary>{SECTIONS.map(([key, label, placeholder]) => <Field key={key} label={label}><textarea rows={3} maxLength={20000} value={m[key]} placeholder={placeholder} onChange={e => meta({ [key]: e.target.value })} /></Field>)}</details> : <div className="listing-body"><h2>本文</h2><BlockEditor blocks={record.blocks} onChange={blocks => patch({ blocks })} /></div>}
              {!repair && <button className="listing-text-button" onClick={() => saveAndGo(`#/record/${record.id}/content`)}>数字・観測・出典などを詳しく編集する<Icon name="right" size={15} /></button>}
            </div>}
            {step === 'review' && <><div className="listing-review-layout"><button className="listing-preview-button" onClick={() => setPreviewOpen(true)} aria-label="掲載ページをプレビュー">{card(shown)}<span><Icon name="search" size={16} />プレビューを見る</span></button><div className="listing-review-summary"><h2>準備が整いましたか？</h2>
              {[['基本情報', 'details', [m.crop, m.region].filter(Boolean).join(' · ') || '未入力'], ['写真・資料', 'photos', `${m.attachments.length}件${m.coverUrl ? ' · 写真URLあり' : ''}`], ['タイトル', 'title', record.title || '未入力'], ['説明', 'description', m.summary ? '概要を入力済み' : '概要は未入力']].map(([label, target, value]) => <div className="listing-review-row" key={target}><div><strong>{label}</strong><p>{value}</p></div><button className="listing-text-button" onClick={() => move(target)} aria-label={`${label}を編集`}>編集</button></div>)}
              {published && <p className="listing-hint">{publication.loading ? '掲載中の内容を確認中…' : publication.error ? '掲載中の内容を取得できませんでした。' : differs === null ? '掲載中の内容を確認できません。' : differs ? '変更した内容は、更新すると反映されます。' : '掲載中の内容と同じです。'}</p>}
            </div></div>
            <div className="listing-confirmation"><Icon name="shield" size={25} /><div><h2>掲載する内容を確認してください</h2><p>本文・名前・地域・写真・資料が掲載されます。個人情報や、掲載できない内容がないかご確認ください。</p><p className="listing-hint">現在の閲覧範囲は、サイトのアクセス設定に従います。</p><label><input type="checkbox" checked={confirmed} onChange={e => setCheckedKey(e.target.checked ? shownKey : '')} />この内容で掲載することを確認しました</label></div></div>
            {!!problems.length && <div className="listing-problems" role="alert"><h2>掲載前に修正してください</h2><ul>{problems.map(problem => <li key={problem}>{problem}</li>)}</ul></div>}
            {!known && <ErrorNotice retry={publication.retry}>掲載状態を確認できていません。</ErrorNotice>}
            {!verified && <button className="listing-secondary" onClick={onAccount}>アカウントを確認する</button>}
            {unsaved && <ErrorNotice retry={save.retry}>下書きの保存が完了してから掲載できます。</ErrorNotice>}
            </>}
          </fieldset>
        </>}
        {error && <ErrorNotice>{error}</ErrorNotice>}
        {save.sync.cacheFailed && step !== 'review' && <ErrorNotice retry={save.retry}>下書きを保存できていません。</ErrorNotice>}
      </section>
      <footer className="listing-footer"><div className="listing-progress" role="progressbar" aria-label="掲載の準備" aria-valuemin={0} aria-valuemax={6} aria-valuenow={Math.max(0, index)} aria-valuetext={step === 'intro' ? 'これから開始します' : `${phase + 1} / 3 ${LISTING_PHASES[phase].title}`}>{LISTING_PHASES.map((p, i) => <div key={p.title}><span style={{ width: `${i < phase ? 100 : i === phase ? (p.steps.indexOf(step) + 1) / p.steps.length * 100 : 0}%` }} /></div>)}</div>
        <div className="listing-footer-actions">{index > 0 ? <button className="listing-back" disabled={busy} onClick={() => move(LISTING_STEPS[index - 1])}>戻る</button> : <span className="listing-footer-note">途中で保存して、いつでも再開できます。</span>}
          <span className="listing-footer-step">{step !== 'intro' && `${index} / 6`}</span>
          <button className={`listing-primary${step === 'review' ? ' publish' : ''}`} disabled={step === 'review' ? blocked : busy} onClick={step === 'review' ? publish : next}>{publishing ? '掲載しています…' : step === 'intro' ? 'はじめる' : step === 'review' ? published ? '掲載内容を更新' : '掲載する' : '次へ'}{step !== 'review' && <Icon name="right" size={17} />}</button>
        </div>
      </footer>
    </>}
    {previewOpen && <Dialog title="掲載ページのプレビュー" onClose={() => setPreviewOpen(false)} wide className="listing-preview-dialog"><Suspense fallback={<p role="status">読み込み中…</p>}><PublicRecord record={shown} preview /></Suspense></Dialog>}
    {repairOpen && <Suspense fallback={<p role="status">編集画面を準備中…</p>}><RepairEntrySheet record={record} onSave={onChange} onClose={() => setRepairOpen(false)} /></Suspense>}
  </div>
}
