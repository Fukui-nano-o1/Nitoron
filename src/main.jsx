import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const initialObservations = [
  { id: 'o1', title: '圃場の変化を記録する', body: '写真・数字・文章を、まず観測事実として残します。', crop: 'ブロッコリー', date: '2026-09-03', type: '記録' },
  { id: 'o2', title: '発表の核をつくる', body: '観測をつなぎ、再現できる判断へ変えます。', crop: '共通', date: '2026-09-02', type: '仮説' },
]

const pages = [
  { id: 'home', label: 'ホーム', eyebrow: 'Nitoron', title: '観測から、農業の知恵をつくる。', description: '事実を残し、つなぎ、次の判断に変える。' },
  { id: 'observations', label: '観測', eyebrow: 'Observation', title: '観測', description: 'まだ結論にしない。起きたことを、そのまま残す。' },
  { id: 'presentation', label: '発表', eyebrow: 'Presentation', title: '経営発表', description: '観測を選び、伝わる順序に並べる。' },
]

function App() {
  const [active, setActive] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showComposer, setShowComposer] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [observations, setObservations] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nitoron:observations')) || initialObservations } catch { return initialObservations }
  })
  const [draft, setDraft] = useState({ title: '', body: '', crop: '', type: '記録' })

  useEffect(() => localStorage.setItem('nitoron:observations', JSON.stringify(observations)), [observations])
  useEffect(() => {
    const keydown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setShowSearch(true) }
      if (event.key === 'Escape') { setShowSearch(false); setShowComposer(false) }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [])

  const page = pages.find((item) => item.id === active)
  const visible = useMemo(() => observations.filter((item) => `${item.title} ${item.body} ${item.crop} ${item.type}`.toLowerCase().includes(query.toLowerCase())), [observations, query])
  const addObservation = () => {
    if (!draft.title.trim() && !draft.body.trim()) return
    setObservations((current) => [{ id: crypto.randomUUID(), title: draft.title.trim() || '名前のない観測', body: draft.body.trim(), crop: draft.crop.trim() || '未分類', type: draft.type, date: new Date().toISOString().slice(0, 10) }, ...current])
    setDraft({ title: '', body: '', crop: '', type: '記録' })
    setShowComposer(false)
    setActive('observations')
  }
  const removeObservation = (id) => setObservations((current) => current.filter((item) => item.id !== id))
  const navigate = (id) => { setActive(id); setSidebarOpen(false) }

  return <div className={`app ${sidebarOpen ? 'sidebar-visible' : ''}`}>
    <aside className="sidebar" aria-label="ワークスペース">
      <div className="workspace-name"><span>Nitoron</span><button onClick={() => setSidebarOpen(false)} aria-label="サイドバーを閉じる">×</button></div>
      <button className="search-trigger" onClick={() => setShowSearch(true)}><span>検索</span><kbd>⌘ K</kbd></button>
      <button className="new-page" onClick={() => setShowComposer(true)}>＋ 観測を追加</button>
      <nav>{pages.map((item) => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>{item.label}</button>)}</nav>
      <div className="sidebar-foot"><span>個人用</span><span>ローカル保存</span></div>
    </aside>

    <main className="main">
      <header className="topbar">
        <button className="sidebar-toggle" onClick={() => setSidebarOpen((open) => !open)} aria-label="サイドバーを開く">☰</button>
        <div className="crumb"><span>Nitoron</span><i>/</i><span>{page.label}</span></div>
        <button className="top-add" onClick={() => setShowComposer(true)}>新規</button>
      </header>
      <section className="page-canvas">
        <p className="eyebrow">{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <p className="description">{page.description}</p>
        {active === 'home' && <Home observations={observations} onNavigate={navigate} onCompose={() => setShowComposer(true)} />}
        {active === 'observations' && <Observations items={observations} onCompose={() => setShowComposer(true)} onDelete={removeObservation} />}
        {active === 'presentation' && <Presentation items={observations} />}
      </section>
    </main>
    <nav className="mobile-nav">{pages.map((item) => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>{item.label}</button>)}<button onClick={() => setShowComposer(true)}>追加</button></nav>
    {showComposer && <Composer draft={draft} setDraft={setDraft} onClose={() => setShowComposer(false)} onSave={addObservation} />}
    {showSearch && <Search query={query} setQuery={setQuery} items={visible} onClose={() => setShowSearch(false)} onPick={() => { setShowSearch(false); setActive('observations') }} />}
  </div>
}

function Home({ observations, onNavigate, onCompose }) { return <>
  <div className="home-actions"><button className="primary" onClick={onCompose}>観測を追加</button><button onClick={() => onNavigate('observations')}>すべての観測を見る</button></div>
  <div className="section-head"><h2>最近の観測</h2><button onClick={() => onNavigate('observations')}>一覧へ</button></div>
  <div className="database">{observations.slice(0, 4).map((item) => <ObservationRow key={item.id} item={item} />)}</div>
</> }
function Observations({ items, onCompose, onDelete }) { return <>
  <div className="section-head"><h2>{items.length}件の観測</h2><button onClick={onCompose}>＋ 追加</button></div>
  <div className="database">{items.length ? items.map((item) => <ObservationRow key={item.id} item={item} onDelete={() => onDelete(item.id)} />) : <Empty onClick={onCompose} />}</div>
</> }
function ObservationRow({ item, onDelete }) { return <article className="observation-row" data-semantic-role={item.type} data-section-group={item.crop}>
  <div className="row-main"><p className="row-title">{item.title}</p>{item.body && <p className="row-body">{item.body}</p>}<div className="meta"><span>{item.type}</span><span>{item.crop}</span><span>{item.date}</span></div></div>
  {onDelete && <button className="row-delete" onClick={onDelete}>削除</button>}
</article> }
function Presentation({ items }) { const chosen = items.slice(0, 5); return <>
  <div className="presentation-note">発表の土台です。観測が増えるほど、原因・行動・結果をつなげられます。</div>
  <div className="presentation-paper"><p className="paper-label">経営発表・下書き</p><h2>観測から得た学び</h2><p>以下の観測をもとに、課題・原因・行動・成果を組み立てます。</p>{chosen.map((item, index) => <div className="paper-item" key={item.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><p>{item.body || '内容を追加してください。'}</p></div></div>)}</div>
</> }
function Empty({ onClick }) { return <div className="empty"><p>まだ観測がありません。</p><button onClick={onClick}>最初の観測を残す</button></div> }
function Composer({ draft, setDraft, onClose, onSave }) { return <div className="overlay" role="dialog" aria-modal="true"><div className="composer"><div className="modal-head"><span>新しい観測</span><button onClick={onClose}>×</button></div><input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="何が起きた？"/><textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="事実・数字・写真の説明を残す"/><div className="composer-options"><select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}><option>記録</option><option>仮説</option><option>気づき</option></select><input value={draft.crop} onChange={(e) => setDraft({ ...draft, crop: e.target.value })} placeholder="作物・テーマ"/></div><div className="modal-actions"><button onClick={onClose}>キャンセル</button><button className="primary" onClick={onSave}>残す</button></div></div></div> }
function Search({ query, setQuery, items, onClose, onPick }) { return <div className="overlay search-overlay" role="dialog" aria-modal="true"><div className="search-modal"><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="観測を検索"/><div className="search-results">{items.map((item) => <button key={item.id} onClick={onPick}><strong>{item.title}</strong><span>{item.crop} ・ {item.date}</span></button>)}{!items.length && <p>一致する観測はありません。</p>}</div><p className="search-hint">Escで閉じる</p><button className="close-search" onClick={onClose}>閉じる</button></div></div> }

createRoot(document.getElementById('root')).render(<App />)
