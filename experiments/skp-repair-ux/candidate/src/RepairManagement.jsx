import React, { useEffect, useState } from 'react'
import { Dialog } from './ui.jsx'
import { publicSnapshot, publicationKey, publicationProblems } from './domain.js'
import RepairRecordInfo from './RepairRecordInfo.jsx'

// Existing publication callbacks retain their flush, ownership and stale-edit
// checks. Opening the repair workspace never changes publication state.
export default function RepairManagement({ record, management: m, save, onClose }) {
  const [mode, setMode] = useState('menu'), [checked, setChecked] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const shown = publicSnapshot(record), shownKey = publicationKey(shown)
  useEffect(() => setChecked(false), [shownKey])
  const problems = publicationProblems(record)
  const verified = !!m.session?.user && !m.session.user.is_anonymous && !!m.session.user.email_confirmed_at
  const blocked = !m.known || !verified || problems.length > 0 || !!save?.error || !!save?.sync?.cacheFailed || !!save?.sync?.pending || m.publishing || !checked
  const remove = async () => {
    setBusy(true); setError('')
    try { await m.onDelete(); onClose() } catch (e) { setError(e.message || '削除できませんでした。') } finally { setBusy(false) }
  }
  return <Dialog title={mode === 'publish' ? '公開する内容' : mode === 'delete' ? '記録を削除' : '公開・記録管理'} onClose={onClose}>
    {mode === 'menu' && <><p>{!m.known ? '公開状態を確認できません' : m.published ? '公開中' : '非公開'}</p><div className="repair-menu">
      {!m.known && <button onClick={m.onRetry}>公開状態を再確認</button>}
      {m.published && <><a href={`#/public/${record.id}`}>公開版を見る</a><button disabled={!m.session || m.publishing} onClick={m.onUnpublish}>公開を停止</button></>}
      <button disabled={!m.known} onClick={() => setMode('publish')}>{m.published ? '公開版を更新' : '公開する内容を確認'}</button>
      <button onClick={() => setMode('delete')}>記録を削除</button>
    </div></>}
    {mode === 'publish' && <>
      <p>下の内容がリンクから誰でも読めるようになります。</p>
      <RepairRecordInfo record={shown} />
      {!!problems.length && <ul>{problems.map(text => <li key={text}>{text}</li>)}</ul>}
      {!verified && <button className="text-action" onClick={m.onAccount}>公開用のアカウントを確認</button>}
      {(save?.error || save?.sync?.cacheFailed || save?.sync?.pending > 0) && <p role="alert">先に記録の保存を完了してください。</p>}
      <label className="repair-publish-check"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />公開する内容を確認した</label>
      {m.publishResult && <p role="status">{m.publishResult.ok ? '公開しました' : m.publishResult.message}</p>}
      <div className="repair-sheet-footer"><button onClick={() => setMode('menu')}>戻る</button><button className="primary" disabled={blocked} onClick={m.onPublish}>{m.publishing ? '公開中…' : m.published ? '公開版を更新する' : '公開する'}</button></div>
    </>}
    {mode === 'delete' && <><p>「{record.title}」を削除します。元に戻せません。公開したことのある記録では、指摘も削除されます。</p>
      {m.published ? <p>先に公開を停止してください。</p> : !m.known ? <p>公開状態を確認してから削除してください。</p> : <button className="danger" disabled={busy} onClick={remove}>削除する</button>}
      {error && <p role="alert">{error}</p>}<button className="text-action" onClick={() => setMode('menu')}>戻る</button>
    </>}
  </Dialog>
}
