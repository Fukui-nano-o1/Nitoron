import React, { useState } from 'react'
import BlockEditor from './BlockEditor.jsx'
import Cover from './Cover.jsx'
import Attachments from './Attachments.jsx'
import Icon from './Icon.jsx'
import { KINDS, PHASES, VERDICTS, SECTIONS, METRICS, emptyMeta, today, uid, exportMarkdown } from './domain.js'
import { Field, Dialog, download } from './ui.jsx'

export const STEPS = [['basics', '基本情報'], ['content', '内容・資料'], ['review', '掲載の準備']]
// 保存状態チップ。端末保存成功・クラウド同期失敗＝「端末に保存・同期待ち」、端末保存にも失敗＝「保存できていません」。再試行はどの段階からも押せる。
export function SaveChip({ save }) {
  const trouble = save.sync.cacheFailed || (save.session && save.sync.pending > 0) || !!save.error
  return <span className={`save-chip${trouble ? ' trouble' : ''}`} role="status"><span>{save.status}</span>{trouble && <button className="quiet" onClick={save.retry}>再試行</button>}</span>
}
// 記録の編集。発表は「基本情報 → 内容・資料 → 確認・公開」の3段階。段階を移動しても自動保存は続く。
export default function Editor({ record, step, onStep, onChange, session, flush, save, published, onUnpublish, onShare, onDelete, discussion }) {
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

  // 参照元（旧仕様で作られた派生記録に残る）。公開中なら公開ページへ。第三者向けの公開画面には非公開の参照先を出さない（RecordBody側）。
  const originLine = m.origin && <p className="source-line">参考にした記録：{m.origin.public ? <a href={`#/public/${m.origin.id}`}>{m.origin.title || '記録'}</a> : m.origin.title || '記録'}{!m.origin.public && <small>（非公開の自分の記録）</small>}</p>
  const facts = m.observations.filter(o => o.fact.trim()).length
  const reflecting = ['振り返り', '完了'].includes(m.stage)
  const excerpt = text => text ? (text.length > 160 ? `${text.slice(0, 160)}…` : text) : <span className="unrecorded">未入力</span>
  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  // 振り返り：目標・判定基準と結果・観測を見比べて、本人が判定を選ぶ。入力欄は既存項目を再利用し、同じ項目を重複させない。
  const reflection = m.kind === 'challenge' && <section id="reflection" className={`editor-section reflection${reflecting ? ' now' : ''}`}>
    <div className="section-heading"><span className="section-number">LOOK</span><h2>振り返り</h2><span className="state-label">{m.stage}</span></div>
    <div className="reflection-grid">
      <div><h3>目標</h3><p>{excerpt(m.target)}</p><h3>確かめる方法・判定基準</h3><p>{excerpt(m.criterion)}</p><button className="text-action" onClick={() => onStep('basics')}>基本情報で編集</button></div>
      <div><h3>結果</h3>{m.inputMode === 'sections' ? <><p>{excerpt(m.result)}</p><button className="text-action" onClick={() => scrollTo('section-result')}>04 結果で編集</button></> : <textarea className="section-input" aria-label="結果" rows={3} maxLength={20000} value={m.result} onChange={e => meta({ result: e.target.value })} placeholder="測定や記録から確認できたこと。失敗や変化なしも残す" />}
        <h3>観測した事実</h3><p>{facts}件</p><button className="text-action" onClick={() => scrollTo('observations')}>観測を編集</button></div>
    </div>
    <Field label="本人の判定" help="目標・判定基準と結果・観測を見比べて選びます。進捗や観測件数から自動では決まりません。"><select value={m.verdict} onChange={e => meta({ verdict: e.target.value })}><option value="">まだ選ばない</option>{VERDICTS.map(v => <option key={v} value={v}>{v}</option>)}</select></Field>
    {m.inputMode === 'sections' ? <><h3 className="reflection-sub">学びと次の一手</h3><p className="reflection-text">{excerpt(m.learning)}</p><button className="text-action" onClick={() => scrollTo('section-learning')}>06 学びと次の一手で編集</button></>
      : <Field label="学びと次の一手" help="次に変えること・続けること・やめること。次の挑戦の仮説に引き継げます。"><textarea rows={3} maxLength={20000} value={m.learning} onChange={e => meta({ learning: e.target.value })} placeholder="次に変えること・続けること・やめること" /></Field>}
  </section>
  const next = () => onStep(STEPS[index + 1][0]), prev = () => onStep(STEPS[index - 1][0])
  return <>
    {toolbar}
    <nav className="stepper print-hidden" aria-label="入力の段階">{STEPS.map(([key, label], i) => <button key={key} disabled={uploading} aria-current={key === step ? 'step' : undefined} onClick={() => onStep(key)}><span className="step-number">{i + 1}</span><span>{label}</span></button>)}</nav>
    <div className="document-layout">
      <article className={`document step-${step}`}>
        {step === 'basics' && <>
          <input className="title-input" aria-label="記録のタイトル" placeholder="発表のタイトル" maxLength={200} value={record.title} onChange={e => patch({ title: e.target.value })} />
          <Field label="分類" help="切り替えても入力済みの内容は消えません。挑戦にすると計画の項目が加わります。"><select value={m.kind} onChange={e => meta({ kind: e.target.value })}>{Object.entries(KINDS).filter(([key]) => key !== 'memo').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
          <div className="fields two">{textInput('crop', '作物', '例：ブロッコリー')}{textInput('region', '地域', '都道府県・市町村')}</div>
          <div className="fields two">{textInput('author', '発表者名')}{textInput('club', '所属クラブ')}</div>
          <div className="fields two">{textInput('variety', '品種')}<Field label="対象面積（a）"><input type="number" min="0.01" step="any" value={m.areaA} onChange={e => meta({ areaA: e.target.value })} placeholder="10" /></Field></div>
          <div className="fields two">{textInput('start', '対象期間の開始', '', 'date')}{textInput('end', '対象期間の終了', '', 'date')}</div>
          {originLine}
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
          {originLine}
          {m.kind === 'challenge' && m.inputMode !== 'sections' && <section className="editor-section"><Field label="仮説（未検証の見立て）" help="何を変えると、なぜ、どうなると考えたか。観測した事実とは分けて書きます。"><textarea rows={3} maxLength={20000} value={m.hypothesis} onChange={e => meta({ hypothesis: e.target.value })} placeholder="何を変えると、なぜ、どうなると考えたか" /></Field></section>}
          <section id="document-summary" className="editor-section"><Field label="要約" help="読む人が、試したことと分かったことを最初につかめるように。"><textarea rows={3} maxLength={2000} value={m.summary} onChange={e => meta({ summary: e.target.value })} placeholder="何を試し、何が分かったか。これから試す記録なら、その目的を。" /></Field></section>
          {m.inputMode !== 'sections' ? <section className="editor-section"><div className="section-heading"><h2>本文</h2></div><BlockEditor blocks={record.blocks} onChange={blocks => patch({ blocks })} /></section>
            : SECTIONS.map(([key, label, placeholder], i) => <section id={`section-${key}`} className="editor-section" key={key}>
              <div className="section-heading"><span className="section-number">{String(i + 1).padStart(2, '0')}</span><h2>{label}</h2>{key === 'hypothesis' && <span className="state-label">未検証の見立て</span>}{key === 'interpretation' && <span className="state-label">事実からの解釈</span>}</div>
              <textarea className="section-input" aria-label={label} rows={3} maxLength={20000} value={m[key]} onChange={e => meta({ [key]: e.target.value })} placeholder={placeholder} />
            </section>)}
          <section id="observations" className="editor-section"><div className="section-heading"><span className="section-number">DATA</span><h2>観測した事実</h2></div>
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
          {reflection}
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
        {step === 'review' && <section className="review-panel"><h2>掲載の準備</h2><p>写真・説明・掲載内容を順に確認しましょう。</p><a className="primary" href={`#/listing/${record.id}/review`}>掲載フローへ進む</a></section>}
        {step === 'content' && <details className="details extra-content"><summary>掲載・記録管理</summary><div className="actions"><a className="primary" href={`#/listing/${record.id}`}>掲載フローへ</a>{published && <><a className="secondary" href={`#/public/${record.id}`}>掲載版を見る</a><button className="text-action" onClick={onShare}>リンクを共有</button><button className="text-action" onClick={onUnpublish}>掲載を停止</button></>}<button className="quiet" onClick={() => setConfirmDelete(true)}>記録を削除</button></div>{discussion}</details>}
      </article>
    </div>
    <div className="step-bar print-hidden">{index > 0 ? <button className="secondary" disabled={uploading} onClick={prev}><Icon name="left" size={14} />{STEPS[index - 1][1]}</button> : <span />}
      {index < STEPS.length - 1 ? <button className="primary" disabled={uploading} onClick={next}>次へ：{STEPS[index + 1][1]}<Icon name="right" size={14} /></button> : <button className="primary" onClick={() => onStep('review')}>掲載へ進む</button>}</div>
    {deleteDialog}
  </>
}
