import React, { useState } from 'react'
import { Dialog } from './ui.jsx'

// Existing publication callbacks retain their flush, ownership and stale-edit
// checks. Opening the repair workspace never changes publication state.
export default function RepairManagement({ record, management: m, onClose }) {
  const [mode, setMode] = useState('menu'), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const remove = async () => {
    setBusy(true); setError('')
    try { await m.onDelete(); onClose() } catch (e) { setError(e.message || '削除できませんでした。') } finally { setBusy(false) }
  }
  return <Dialog title={mode === 'delete' ? '記録を削除' : '公開・記録管理'} onClose={onClose}>
    {mode === 'menu' && <><p>{!m.known ? '公開状態を確認できません' : m.published ? '公開中' : '非公開'}</p><div className="repair-menu">
      {!m.known && <button onClick={m.onRetry}>公開状態を再確認</button>}
      {m.published && <><a href={`#/public/${record.id}`}>公開版を見る</a><button disabled={!m.session || m.publishing} onClick={m.onUnpublish}>公開を停止</button></>}
      <a href={`#/listing/${record.id}`}>{m.published ? '掲載内容を更新' : '掲載へ進む'}</a>
      <button onClick={() => setMode('delete')}>記録を削除</button>
    </div></>}
    {mode === 'delete' && <><p>「{record.title}」を削除します。元に戻せません。公開したことのある記録では、指摘も削除されます。</p>
      {m.published ? <p>先に公開を停止してください。</p> : !m.known ? <p>公開状態を確認してから削除してください。</p> : <button className="danger" disabled={busy} onClick={remove}>削除する</button>}
      {error && <p role="alert">{error}</p>}<button className="text-action" onClick={() => setMode('menu')}>戻る</button>
    </>}
  </Dialog>
}
