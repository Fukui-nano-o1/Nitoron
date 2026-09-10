import React, { useState } from 'react'
import Icon from './Icon.jsx'
import Cover from './Cover.jsx'
import { RecordCard } from './Catalog.jsx'
import { PAGE_SIZE, LIST_NAME_MAX } from './community.js'
import { Dialog, Empty, ErrorNotice } from './ui.jsx'

const shareUrl = token => `${location.origin}${location.pathname}#/list/${token}`
async function copyLink(url, notify) {
  try { await navigator.clipboard.writeText(url); notify('共有リンクをコピーしました。') } catch { notify('コピーできませんでした。リンクを選択してコピーしてください。') }
}
// 保存リスト：#/saved（一覧）→ #/saved/all（すべての保存）／#/saved/:listId（名前付きリスト）。
// リストの中身は本人の bookmark に従属し、リストを削除しても発表と bookmark は残る。
export default function SavedList({ session, view, list, lists, records, count, loading, error, page, onPage, savedIds, onSave, activityCounts = {}, keyOf, selectedKeys, onSelect, picking, onPicking, onAccount, notify }) {
  const [creating, setCreating] = useState(false), [name, setName] = useState(''), [menu, setMenu] = useState(false), [busy, setBusy] = useState(false)
  const signedOut = !session
  const card = r => <RecordCard key={r.id} record={r} href={`#/public/${r.id}`} publicMode selected={selectedKeys.includes(keyOf(r))} onSelect={onSelect} picking={picking} saved={savedIds.includes(r.id)} onSave={onSave} newCount={activityCounts[r.id] || 0} />
  const grid = (empty) => error ? null : loading ? <div className="loading-grid" role="status" aria-label="保存リストを読み込み中">{[0, 1, 2, 3, 4, 5, 6, 7].map(i => <div className="card-skeleton" key={i}><div /><span /><span /></div>)}</div>
    : records.length ? <>
      <div className="record-grid">{records.map(card)}</div>
      {count > PAGE_SIZE && <div className="pagination"><button className="secondary" disabled={page === 0} onClick={() => onPage(page - 1)}>前へ</button><span>{page + 1} / {Math.ceil(count / PAGE_SIZE)}</span><button className="secondary" disabled={(page + 1) * PAGE_SIZE >= count} onClick={() => onPage(page + 1)}>次へ</button></div>}
    </> : empty
  const compareBar = <div className="saved-tools print-hidden"><span>{loading ? '読み込み中' : `${count}件`} · 公開中の発表だけが表示されます</span>
    <button className="text-action" aria-pressed={picking} onClick={() => onPicking(!picking)}><Icon name="compare" size={16} />{picking ? '選択をやめる' : '比較する（2〜3件を選ぶ）'}</button></div>

  if (signedOut) return <section className="saved-page">
    <div className="saved-topbar print-hidden"><a className="round-button" href="#/discover" aria-label="みんなの発表へ戻る"><Icon name="left" size={16} /></a></div>
    <header className="saved-heading"><h1>保存リスト</h1></header>
    <div className="saved-empty"><h2>ログインすると保存リストを表示できます</h2><p>ハートを付けた発表を、名前付きのリストに分けて読み返せます。</p><button className="primary" onClick={onAccount}>ログイン</button></div>
  </section>

  // ---- 名前付きリストの中身 ----
  if (view && view !== 'all') {
    if (!lists.ready && !lists.error) return <section className="saved-page"><p className="loading" role="status">保存リストを読み込み中…</p></section>
    if (!list) return <section className="saved-page"><div className="saved-topbar print-hidden"><a className="round-button" href="#/saved" aria-label="保存リストへ戻る"><Icon name="left" size={16} /></a></div>
      {lists.error ? <ErrorNotice retry={lists.retry}>{lists.error}</ErrorNotice> : <Empty title="このリストは見つかりません" action={<a className="secondary" href="#/saved">保存リストへ</a>}>削除されたか、別のアカウントのリストです。</Empty>}</section>
    return <section className="saved-page">
      <div className="saved-topbar print-hidden"><a className="round-button" href="#/saved" aria-label="保存リストへ戻る"><Icon name="left" size={16} /></a><button className="round-button" aria-label="リストの操作" aria-haspopup="dialog" onClick={() => setMenu(true)}><Icon name="menu" size={16} /></button></div>
      <header className="saved-heading"><h1>{list.name}</h1>{list.is_shared && <p className="share-state"><Icon name="share" size={14} />共有中 · リンクを知っている人は誰でも閲覧できます</p>}</header>
      {compareBar}
      {error}
      {grid(<div className="saved-empty"><h2>このリストは空です</h2><p>「すべての保存」の発表でハートを押すと、保存先にこのリストを選べます。</p><a className="primary" href="#/saved/all">すべての保存を見る</a></div>)}
      {menu && <ListMenu list={list} lists={lists} notify={notify} onClose={() => setMenu(false)} />}
    </section>
  }
  // ---- すべての保存 ----
  if (view === 'all') return <section className="saved-page">
    <div className="saved-topbar print-hidden"><a className="round-button" href="#/saved" aria-label="保存リストへ戻る"><Icon name="left" size={16} /></a></div>
    <header className="saved-heading"><h1>すべての保存</h1><p>ハートを付けた発表。保存済みの発表でもう一度ハートを押すと、リストへ振り分けられます。</p></header>
    {compareBar}
    {error}
    {grid(<div className="saved-empty"><h2>まだ保存がありません</h2><p>発表を探しているときにハートを押すと、お気に入りがここに集まります。</p><a className="primary" href="#/discover">発表をさがす</a></div>)}
  </section>
  // ---- 一覧（すべての保存＋名前付きリスト） ----
  const coverOf = listId => records.find(r => lists.items.some(i => i.list_id === listId && i.publication_id === r.id))
  const create = async e => { e.preventDefault(); setBusy(true); try { const made = await lists.create(name); if (made) { setName(''); setCreating(false); location.hash = `/saved/${made.id}` } } finally { setBusy(false) } }
  return <section className="saved-page">
    <div className="saved-topbar print-hidden"><a className="round-button" href="#/discover" aria-label="みんなの発表へ戻る"><Icon name="left" size={16} /></a></div>
    <header className="saved-heading"><h1>保存リスト</h1><p>ハートで保存した発表を、名前付きのリストに分けられます。リストは非公開で作られ、共有はリストごとに選べます。</p></header>
    {error}{lists.error && <ErrorNotice retry={lists.retry}>{lists.error}</ErrorNotice>}
    <div className="list-grid">
      <a className="list-card" href="#/saved/all"><div className="list-cover">{records[0] ? <Cover record={records[0]} /> : <div className="list-cover-empty"><Icon name="heart" size={28} /></div>}</div><strong>すべての保存</strong><span>{loading ? '読み込み中' : `${savedIds.length}件`}</span></a>
      {lists.lists.map(l => { const cover = coverOf(l.id); return <a className="list-card" key={l.id} href={`#/saved/${l.id}`}><div className="list-cover">{cover ? <Cover record={cover} /> : <div className="list-cover-empty"><Icon name="book" size={28} /></div>}</div><strong>{l.name}</strong><span>{lists.countOf(l.id)}件{l.is_shared ? ' · 共有中' : ''}</span></a> })}
      <button className="list-card list-new" disabled={!lists.ready} onClick={() => setCreating(true)}><div className="list-cover"><div className="list-cover-empty"><Icon name="plus" size={28} /></div></div><strong>新しいリスト</strong><span>非公開で作成</span></button>
    </div>
    {creating && <Dialog title="新しいリスト" onClose={() => setCreating(false)}><form className="filter-form" onSubmit={create}>
      <label className="field"><span>リストの名前</span><input maxLength={LIST_NAME_MAX} value={name} onChange={e => setName(e.target.value)} placeholder="例：来年試したい育苗" autoFocus /></label>
      <p className="hint">作成したリストは非公開です。共有はリストの「…」から選べます。</p>
      <div className="dialog-actions"><button className="primary" disabled={!name.trim() || busy}>{busy ? '作成中…' : '作成する'}</button></div>
    </form></Dialog>}
  </section>
}
// リストの「…」：名前変更・共有・削除。共有ON/OFFとトークン発行はサーバー側で一体に行う。
function ListMenu({ list, lists, notify, onClose }) {
  const [name, setName] = useState(list.name), [busy, setBusy] = useState('')
  const rename = async e => { e.preventDefault(); setBusy('rename'); try { if (await lists.rename(list.id, name)) notify('名前を変更しました。') } finally { setBusy('') } }
  const share = async shared => { setBusy('share'); try { const updated = await lists.setSharing(list.id, shared); if (updated) notify(shared ? '共有を開始しました。新しいリンクを発行しました。' : '共有を停止しました。リンクからは閲覧できません。') } finally { setBusy('') } }
  const remove = async () => {
    if (!window.confirm(`リスト「${list.name}」を削除しますか？ リストに入れた発表と「すべての保存」は残ります。`)) return
    setBusy('delete'); try { if (await lists.remove(list.id)) { notify('リストを削除しました。発表と保存は残っています。'); onClose(); location.hash = '/saved' } } finally { setBusy('') }
  }
  return <Dialog title="リストの操作" onClose={onClose}>
    <form className="filter-form" onSubmit={rename}><label className="field"><span>名前</span><input maxLength={LIST_NAME_MAX} value={name} onChange={e => setName(e.target.value)} /></label>
      <div className="dialog-actions"><button className="secondary" disabled={!name.trim() || name.trim() === list.name || !!busy}>{busy === 'rename' ? '変更中…' : '名前を変更'}</button></div></form>
    <section className="share-panel">
      <h3>共有</h3>
      {list.is_shared ? <>
        <p className="hint">共有中です。<strong>リンクを知っている人は誰でも</strong>このリストの公開中の発表を閲覧できます。あなたのメモと、公開停止された発表は含まれません。</p>
        <input aria-label="共有リンク" readOnly value={shareUrl(list.share_token)} onFocus={e => e.target.select()} />
        <div className="dialog-actions wrap"><button className="secondary" disabled={!!busy} onClick={() => copyLink(shareUrl(list.share_token), notify)}>リンクをコピー</button><button className="secondary" disabled={!!busy} onClick={() => share(true)}>{busy === 'share' ? '更新中…' : '新しいリンクにする'}</button><button className="text-action" disabled={!!busy} onClick={() => share(false)}>共有を停止</button></div>
        <p className="hint">停止すると、このリンクは無効になります。再び共有しても以前のリンクは使えません。</p>
      </> : <>
        <p className="hint">非公開です。共有すると、<strong>リンクを知っている人は誰でも</strong>閲覧できる共有リンクが発行されます。</p>
        <div className="dialog-actions"><button className="secondary" disabled={!!busy} onClick={() => share(true)}>{busy === 'share' ? '発行中…' : '共有リンクを発行'}</button></div>
      </>}
    </section>
    <section className="share-panel danger"><h3>削除</h3><p className="hint">リストだけを削除します。入れた発表と「すべての保存」は残ります。</p><div className="dialog-actions"><button className="text-action" disabled={!!busy} onClick={remove}>{busy === 'delete' ? '削除中…' : 'このリストを削除'}</button></div></section>
  </Dialog>
}
