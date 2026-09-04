import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const initialNotes = [
  { id: 'o1', title: 'はじめてのメモ', body: '写真・数字・文章など、気づいたことをそのまま残します。', category: '日常', date: '2026-09-03', type: 'メモ' },
  { id: 'o2', title: 'レポートの下書きをつくる', body: 'メモをつなげて、伝わる形にまとめます。', category: '仕事', date: '2026-09-02', type: 'アイデア' },
]

const PAGES = [
  { id: 'home', icon: '🏠', label: 'ホーム', title: 'ホーム', cover: 'linear-gradient(120deg,#d9e8dc,#eef3e6 55%,#f6f1e3)' },
  { id: 'notes', icon: '📝', label: 'メモ', title: 'メモ', cover: 'linear-gradient(120deg,#cfe3d8,#dcebe2 50%,#eef5ec)' },
  { id: 'report', icon: '📊', label: 'レポート', title: 'レポート', cover: 'linear-gradient(120deg,#e3dccf,#efe9da 55%,#f7f4ea)' },
]

const TYPE_COLORS = { 'メモ': 'tag-blue', 'アイデア': 'tag-yellow', 'タスク': 'tag-green' }

const Icon = {
  search: <svg viewBox="0 0 20 20" width="18" height="18"><path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.65 3.64a.75.75 0 1 1-1.06 1.06l-3.65-3.64A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>,
  plus: <svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M8 2.5c.41 0 .75.34.75.75v4h4a.75.75 0 0 1 0 1.5h-4v4a.75.75 0 0 1-1.5 0v-4h-4a.75.75 0 0 1 0-1.5h4v-4c0-.41.34-.75.75-.75Z"/></svg>,
  chevronsLeft: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M7.28 3.97a.75.75 0 0 1 0 1.06L4.31 8l2.97 2.97a.75.75 0 1 1-1.06 1.06l-3.5-3.5a.75.75 0 0 1 0-1.06l3.5-3.5a.75.75 0 0 1 1.06 0Zm5.5 0a.75.75 0 0 1 0 1.06L9.81 8l2.97 2.97a.75.75 0 1 1-1.06 1.06l-3.5-3.5a.75.75 0 0 1 0-1.06l3.5-3.5a.75.75 0 0 1 1.06 0Z"/></svg>,
  menu: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M2 4.25c0-.41.34-.75.75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.25Zm0 3.75c0-.41.34-.75.75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm.75 3a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H2.75Z"/></svg>,
  dots: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M3.5 8a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm5.75 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0ZM13.75 9.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"/></svg>,
  star: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 1.75a.6.6 0 0 1 .54.34l1.68 3.53 3.87.5a.6.6 0 0 1 .33 1.03l-2.83 2.68.72 3.83a.6.6 0 0 1-.87.64L8 12.44 4.56 14.3a.6.6 0 0 1-.87-.64l.72-3.83-2.83-2.68a.6.6 0 0 1 .33-1.03l3.87-.5L7.46 2.1A.6.6 0 0 1 8 1.75Zm0 2.02L6.74 6.42a.6.6 0 0 1-.46.33l-2.9.38 2.12 2a.6.6 0 0 1 .18.55l-.54 2.88 2.58-1.4a.6.6 0 0 1 .57 0l2.58 1.4-.55-2.88a.6.6 0 0 1 .18-.55l2.13-2-2.9-.38a.6.6 0 0 1-.47-.33L8 3.77Z"/></svg>,
  comment: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 2c3.59 0 6.5 2.39 6.5 5.5S11.59 13 8 13c-.61 0-1.2-.07-1.76-.2l-2.66 1.4a.55.55 0 0 1-.8-.57l.36-2.3C2.06 10.4 1.5 9 1.5 7.5 1.5 4.39 4.41 2 8 2Zm0 1.5c-2.9 0-5 1.86-5 4 0 1.14.55 2.2 1.55 2.96l.36.28-.26 1.68 1.9-1 .33.1c.35.09.73.14 1.12.14 2.9 0 5-1.86 5-4s-2.1-4-5-4Z"/></svg>,
  table: <svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2.5 3.25c0-.41.34-.75.75-.75h9.5c.41 0 .75.34.75.75v9.5c0 .41-.34.75-.75.75h-9.5a.75.75 0 0 1-.75-.75v-9.5ZM4 4v2h3.25V4H4Zm4.75 0v2H12V4H8.75ZM4 7.5v2h3.25v-2H4Zm4.75 0v2H12v-2H8.75ZM4 11v1h3.25v-1H4Zm4.75 0v1H12v-1H8.75Z"/></svg>,
  text: <svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2.75 3h10.5a.75.75 0 0 1 0 1.5h-4.5v8.75a.75.75 0 0 1-1.5 0V4.5h-4.5a.75.75 0 0 1 0-1.5Z"/></svg>,
  tag: <svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M8.69 1.5c.4 0 .78.16 1.06.44l4.31 4.31a1.5 1.5 0 0 1 0 2.12l-5.69 5.69a1.5 1.5 0 0 1-2.12 0L1.94 9.75a1.5 1.5 0 0 1-.44-1.06V3a1.5 1.5 0 0 1 1.5-1.5h5.69Zm0 1.5H3v5.69l4.31 4.31L13 7.31 8.69 3ZM5.5 4.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/></svg>,
  calendar: <svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M5.25 1.5c.41 0 .75.34.75.75V3h4v-.75a.75.75 0 0 1 1.5 0V3h1a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-8A1.5 1.5 0 0 1 3.5 3h1v-.75c0-.41.34-.75.75-.75ZM3.5 6.5v6h9v-6h-9Z"/></svg>,
  page: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M4.5 1.5h5.09c.4 0 .78.16 1.06.44l2.41 2.41c.28.28.44.66.44 1.06v8.09a1.5 1.5 0 0 1-1.5 1.5h-7.5a1.5 1.5 0 0 1-1.5-1.5v-10a1.5 1.5 0 0 1 1.5-1.5ZM4.5 3v10.5H12V5.62L9.38 3H4.5Zm1.25 5.5h4.5a.62.62 0 1 1 0 1.25h-4.5a.62.62 0 0 1 0-1.25Zm0 2.5h3a.62.62 0 1 1 0 1.25h-3a.62.62 0 0 1 0-1.25Z"/></svg>,
  chevronDown: <svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M3.97 5.72a.75.75 0 0 1 1.06 0L8 8.69l2.97-2.97a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 0-1.06Z"/></svg>,
  home: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M7.53 1.72a.75.75 0 0 1 .94 0l5.75 4.6a.75.75 0 0 1 .28.58v6.35a1.25 1.25 0 0 1-1.25 1.25H9.75a.75.75 0 0 1-.75-.75V10.5h-2v3.25a.75.75 0 0 1-.75.75H2.75A1.25 1.25 0 0 1 1.5 13.25V6.9a.75.75 0 0 1 .28-.58l5.75-4.6ZM3 7.26v5.74h2.5V9.75A.75.75 0 0 1 6.25 9h3.5a.75.75 0 0 1 .75.75V13H13V7.26L8 3.26 3 7.26Z"/></svg>,
  inbox: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M3.9 2.5h8.2c.62 0 1.17.38 1.4.95l1.4 3.5c.07.18.1.36.1.55v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12V7.5c0-.19.03-.37.1-.55l1.4-3.5c.23-.57.78-.95 1.4-.95ZM3.9 4 2.7 7h2.8a.75.75 0 0 1 .67.41l.55 1.09h2.56l.55-1.09A.75.75 0 0 1 10.5 7h2.8L12.1 4H3.9ZM2.5 8.5V12h11V8.5h-2.54l-.55 1.09a.75.75 0 0 1-.66.41h-3.5a.75.75 0 0 1-.66-.41L5.04 8.5H2.5Z"/></svg>,
  trash: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M6.5 1.75h3c.41 0 .75.34.75.75v.75h3a.75.75 0 0 1 0 1.5h-.56l-.65 8.42A1.5 1.5 0 0 1 10.55 14.5h-5.1a1.5 1.5 0 0 1-1.5-1.33L3.31 4.75h-.56a.75.75 0 0 1 0-1.5h3V2.5c0-.41.34-.75.75-.75Zm-1.68 3 .62 8.25h5.12l.62-8.25H4.82ZM6.75 6.5c.28 0 .5.22.5.5v4a.5.5 0 0 1-1 0V7c0-.28.22-.5.5-.5Zm2.5 0c.28 0 .5.22.5.5v4a.5.5 0 0 1-1 0V7c0-.28.22-.5.5-.5Z"/></svg>,
  gear: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M6.9 1.5h2.2c.34 0 .63.23.72.56l.34 1.31c.36.15.7.35 1.01.58l1.3-.37a.75.75 0 0 1 .85.35l1.1 1.9a.75.75 0 0 1-.13.92l-.96.93a4.9 4.9 0 0 1 0 1.17l.96.93c.25.24.3.62.13.92l-1.1 1.9a.75.75 0 0 1-.85.35l-1.3-.37c-.31.23-.65.43-1.01.58l-.34 1.3a.75.75 0 0 1-.72.57H6.9a.75.75 0 0 1-.72-.56l-.34-1.31a5.1 5.1 0 0 1-1.01-.58l-1.3.37a.75.75 0 0 1-.85-.35l-1.1-1.9a.75.75 0 0 1 .13-.92l.96-.93a4.9 4.9 0 0 1 0-1.17l-.96-.93a.75.75 0 0 1-.13-.92l1.1-1.9a.75.75 0 0 1 .85-.35l1.3.37c.31-.23.65-.43 1.01-.58l.34-1.3a.75.75 0 0 1 .72-.57ZM8 5.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/></svg>,
  clock: <svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" d="M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 1.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 1.25c.41 0 .75.34.75.75v2.69l1.78 1.78a.75.75 0 1 1-1.06 1.06l-2-2A.75.75 0 0 1 7.25 8V5c0-.41.34-.75.75-.75Z"/></svg>,
  sparkle: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 1.25c.3 0 .57.18.68.46l1.1 2.74 2.74 1.1a.73.73 0 0 1 0 1.36l-2.74 1.1-1.1 2.74a.73.73 0 0 1-1.36 0l-1.1-2.74-2.74-1.1a.73.73 0 0 1 0-1.36l2.74-1.1 1.1-2.74A.73.73 0 0 1 8 1.25Zm5 8.25c.26 0 .49.16.58.4l.55 1.47 1.47.55a.62.62 0 0 1 0 1.16l-1.47.55-.55 1.47a.62.62 0 0 1-1.16 0l-.55-1.47-1.47-.55a.62.62 0 0 1 0-1.16l1.47-.55.55-1.47c.09-.24.32-.4.58-.4Z"/></svg>,
  book: <svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" d="M4.25 1.5h8.25c.41 0 .75.34.75.75v11.5a.75.75 0 0 1-.75.75H4.25A2.25 2.25 0 0 1 2 12.25v-8.5A2.25 2.25 0 0 1 4.25 1.5ZM3.5 12.25c0 .41.34.75.75.75h7.5v-2H4.25a.75.75 0 0 0-.75.75v.5Zm8.25-2.75V3H4.25a.75.75 0 0 0-.75.75v5.88c.24-.08.49-.13.75-.13h7.5Z"/></svg>,
  checkbox: <svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" d="M3.5 2h9A1.5 1.5 0 0 1 14 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2Zm0 1.5v9h9v-9h-9Zm7.53 2.47a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06l.97.97 2.47-2.47a.75.75 0 0 1 1.06 0Z"/></svg>,
}

function App() {
  const [active, setActive] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 720)
  const [showComposer, setShowComposer] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [starred, setStarred] = useState(false)
  const [notes, setNotes] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('nitoron:observations'))
      if (!stored) return initialNotes
      return stored.map((item) => ({ ...item, category: item.category ?? item.crop ?? '未分類', type: TYPE_COLORS[item.type] ? item.type : 'メモ' }))
    } catch { return initialNotes }
  })
  const [draft, setDraft] = useState({ title: '', body: '', category: '', type: 'メモ' })

  useEffect(() => localStorage.setItem('nitoron:observations', JSON.stringify(notes)), [notes])
  useEffect(() => {
    const keydown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setShowSearch(true) }
      if (event.key === 'Escape') { setShowSearch(false); setShowComposer(false) }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [])

  const page = PAGES.find((item) => item.id === active)
  const visible = useMemo(() => notes.filter((item) => `${item.title} ${item.body} ${item.category} ${item.type}`.toLowerCase().includes(query.toLowerCase())), [notes, query])
  const addNote = () => {
    if (!draft.title.trim() && !draft.body.trim()) return
    setNotes((current) => [{ id: crypto.randomUUID(), title: draft.title.trim() || '無題', body: draft.body.trim(), category: draft.category.trim() || '未分類', type: draft.type, date: new Date().toISOString().slice(0, 10) }, ...current])
    setDraft({ title: '', body: '', category: '', type: 'メモ' })
    setShowComposer(false)
    setActive('notes')
  }
  const removeNote = (id) => setNotes((current) => current.filter((item) => item.id !== id))
  const navigate = (id) => { setActive(id); if (window.innerWidth <= 720) setSidebarOpen(false) }

  return <div className={`app ${sidebarOpen ? 'sidebar-visible' : ''}`}>
    <aside className="sidebar" aria-label="ワークスペース">
      <div className="switcher">
        <button className="switcher-name"><span className="ws-logo">N</span><span className="ws-label">Nitoron</span>{Icon.chevronDown}</button>
        <button className="icon-btn collapse" onClick={() => setSidebarOpen(false)} aria-label="サイドバーを閉じる">{Icon.chevronsLeft}</button>
      </div>
      <div className="side-section">
        <button className="side-item" onClick={() => setShowSearch(true)}><span className="side-ico">{Icon.search}</span>検索<kbd>⌘K</kbd></button>
        <button className={`side-item ${active === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}><span className="side-ico">{Icon.home}</span>ホーム</button>
        <button className="side-item"><span className="side-ico">{Icon.inbox}</span>受信トレイ</button>
      </div>
      <div className="side-section">
        <p className="side-heading">プライベート</p>
        {PAGES.map((item) => <button key={item.id} className={`side-item page-item ${active === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}>
          <span className="side-ico emoji">{item.icon}</span><span className="side-label">{item.label}</span>
          <span className="row-hover-actions"><span className="mini-btn">{Icon.dots}</span><span className="mini-btn">{Icon.plus}</span></span>
        </button>)}
        <button className="side-item muted" onClick={() => setShowComposer(true)}><span className="side-ico">{Icon.plus}</span>新規ページ</button>
      </div>
      <div className="side-section bottom">
        <button className="side-item muted"><span className="side-ico">{Icon.gear}</span>設定</button>
        <button className="side-item muted"><span className="side-ico">{Icon.trash}</span>ゴミ箱</button>
      </div>
    </aside>
    {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

    <main className="main">
      <header className="topbar">
        {!sidebarOpen && <button className="icon-btn" onClick={() => setSidebarOpen(true)} aria-label="サイドバーを開く">{Icon.menu}</button>}
        <button className="crumb"><span className="crumb-ico">{page.icon}</span><span>{page.label}</span></button>
        <div className="topbar-right">
          <span className="edited">今日 編集</span>
          <button className="top-share">共有</button>
          <button className="icon-btn" aria-label="コメント">{Icon.comment}</button>
          <button className={`icon-btn ${starred ? 'starred' : ''}`} onClick={() => setStarred((s) => !s)} aria-label="お気に入り">{Icon.star}</button>
          <button className="icon-btn" aria-label="その他">{Icon.dots}</button>
        </div>
      </header>

      <div className="scroll-area">
        {active === 'home' ? <section className="home-canvas">
          <Home notes={notes} onNavigate={navigate} onCompose={() => setShowComposer(true)} onSearch={() => setShowSearch(true)} />
        </section> : <>
          <div className="cover" style={{ background: page.cover }}><button className="cover-btn">カバー画像を変更</button></div>
          <section className="page-canvas">
            <div className="page-icon"><button>{page.icon}</button></div>
            <div className="title-controls"><button>😀 アイコンを変更</button><button>🖼 カバー画像を追加</button><button>💬 コメントを追加</button></div>
            <h1 className="page-title">{page.title}</h1>
            {active === 'notes' && <Database items={notes} onCompose={() => setShowComposer(true)} onDelete={removeNote} />}
            {active === 'report' && <Report items={notes} />}
          </section>
        </>}
      </div>
    </main>

    <nav className="mobile-nav">{PAGES.map((item) => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><span>{item.icon}</span>{item.label.slice(0, 4)}</button>)}<button onClick={() => setShowComposer(true)}><span>＋</span>新規</button></nav>
    {showComposer && <Composer draft={draft} setDraft={setDraft} onClose={() => setShowComposer(false)} onSave={addNote} />}
    {showSearch && <Search query={query} setQuery={setQuery} items={visible} onClose={() => setShowSearch(false)} onPick={() => { setShowSearch(false); setActive('notes') }} />}
  </div>
}

const LEARN_CARDS = [
  { id: 'l1', emoji: '🚀', title: 'Nitoronをはじめよう', sub: '3分で読めます', cover: 'linear-gradient(135deg,#fdecc8,#f6e0b8)' },
  { id: 'l2', emoji: '📝', title: 'メモの基本', sub: '5分で読めます', cover: 'linear-gradient(135deg,#dbeddb,#c9e2cd)' },
  { id: 'l3', emoji: '🗂️', title: 'データベースで整理する', sub: '4分で読めます', cover: 'linear-gradient(135deg,#d3e5ef,#c2d8e8)' },
  { id: 'l4', emoji: '⌨️', title: 'ショートカット一覧', sub: '2分で読めます', cover: 'linear-gradient(135deg,#e8deee,#dccfe6)' },
]

function SectionHead({ icon, label }) {
  return <div className="home-sec">
    <span className="home-sec-ico">{icon}</span><span>{label}</span><span className="home-sec-caret">{Icon.chevronDown}</span>
    <button className="icon-btn home-sec-more" aria-label="オプション">{Icon.dots}</button>
  </div>
}

function Home({ notes, onNavigate, onCompose, onSearch }) {
  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'こんばんは' : hour < 11 ? 'おはようございます' : hour < 18 ? 'こんにちは' : 'こんばんは'
  const fmtDay = (offset) => {
    const d = new Date(); d.setDate(d.getDate() + offset)
    return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(d)
  }
  return <>
    <h1 className="home-hello">{greeting}、たきとさん</h1>
    <button className="ai-bar" onClick={onSearch}>
      <span className="ai-ico">{Icon.sparkle}</span>
      <span className="ai-placeholder">検索したり、質問したりしましょう…</span>
      <span className="ai-kbd"><kbd>⌘</kbd><kbd>K</kbd></span>
    </button>

    <SectionHead icon={Icon.clock} label="最近アクセスしたページ" />
    <div className="card-row">
      {PAGES.filter((p) => p.id !== 'home').map((p) => <button key={p.id} className="page-card" onClick={() => onNavigate(p.id)}>
        <div className="card-cover" style={{ background: p.cover }} /><span className="card-emoji">{p.icon}</span>
        <p className="card-name">{p.label}</p><p className="card-sub"><span className="card-sub-ico">{Icon.clock}</span>今日</p>
      </button>)}
      {notes.slice(0, 2).map((item) => <button key={item.id} className="page-card" onClick={() => onNavigate('notes')}>
        <div className="card-cover plain" /><span className="card-emoji">📄</span>
        <p className="card-name">{item.title}</p><p className="card-sub"><span className="card-sub-ico">{Icon.clock}</span>{item.date.slice(5).replace('-', '/')}</p>
      </button>)}
      <button className="page-card new" onClick={onCompose}><span className="card-plus">{Icon.plus}</span><p className="card-name">新規ページ</p></button>
    </div>

    <SectionHead icon={Icon.calendar} label="今後の予定" />
    <div className="event-widget">
      <div className="event-day">
        <p className="event-date"><b>今日</b> {fmtDay(0)}</p>
        <div className="event blue"><p className="event-name">メモを見返す</p><p className="event-time">9:00 – 9:30</p></div>
        <div className="event green"><p className="event-name">レポートを書く</p><p className="event-time">16:00 – 17:00</p></div>
      </div>
      <div className="event-day">
        <p className="event-date"><b>明日</b> {fmtDay(1)}</p>
        <div className="event gray"><p className="event-name">週次のふりかえり</p><p className="event-time">終日</p></div>
      </div>
      <div className="event-day connect">
        <p className="event-date">カレンダー</p>
        <p className="connect-text">カレンダーを接続すると、ここに予定が表示されます。</p>
        <button className="connect-btn">カレンダーを接続</button>
      </div>
    </div>

    <SectionHead icon={Icon.checkbox} label="マイタスク" />
    <div className="home-widget">
      <div className="widget-tabs"><button className="widget-tab active">{Icon.table}<span>メモ</span></button><button className="widget-tab">{Icon.plus}</button></div>
      <div className="widget-rows">
        {notes.slice(0, 4).map((item) => <button key={item.id} className="widget-row" onClick={() => onNavigate('notes')}>
          <span className="link-ico">{Icon.page}</span>
          <span className="widget-row-title">{item.title}</span>
          <span className={`tag ${TYPE_COLORS[item.type] || 'tag-gray'}`}>{item.type}</span>
          <span className="widget-row-date">{item.date}</span>
        </button>)}
        <button className="widget-row new" onClick={onCompose}><span className="link-ico">{Icon.plus}</span><span className="widget-row-title muted">新規</span></button>
      </div>
      <button className="widget-foot" onClick={() => onNavigate('notes')}>すべて表示</button>
    </div>

    <SectionHead icon={Icon.book} label="学ぶ" />
    <div className="learn-row">
      {LEARN_CARDS.map((card) => <button key={card.id} className="learn-card">
        <div className="learn-cover" style={{ background: card.cover }}><span>{card.emoji}</span></div>
        <p className="learn-title">{card.title}</p>
        <p className="learn-sub">{card.sub}</p>
      </button>)}
    </div>
  </>
}

function Database({ items, onCompose, onDelete }) {
  return <div className="db">
    <div className="db-toolbar">
      <div className="db-views"><button className="db-view active">{Icon.table}<span>テーブルビュー</span></button><button className="db-view muted">{Icon.plus}</button></div>
      <div className="db-actions"><button>フィルター</button><button>並べ替え</button><button className="icon-btn">{Icon.search}</button><button className="icon-btn">{Icon.dots}</button><button className="db-new" onClick={onCompose}>新規<span className="db-new-caret">{Icon.chevronDown}</span></button></div>
    </div>
    <div className="db-scroll">
      <table className="db-table">
        <thead><tr>
          <th><span>{Icon.text}名前</span></th>
          <th><span>{Icon.tag}タグ</span></th>
          <th><span>{Icon.tag}カテゴリ</span></th>
          <th><span>{Icon.calendar}日付</span></th>
          <th className="th-plus"><span>{Icon.plus}</span></th>
        </tr></thead>
        <tbody>
          {items.map((item) => <tr key={item.id}>
            <td className="cell-name"><span className="cell-ico">{Icon.page}</span><span className="cell-title">{item.title}</span><button className="open-hint" onClick={() => onDelete(item.id)}>削除</button></td>
            <td><span className={`tag ${TYPE_COLORS[item.type] || 'tag-gray'}`}>{item.type}</span></td>
            <td><span className="tag tag-brown">{item.category}</span></td>
            <td className="cell-date">{item.date}</td>
            <td />
          </tr>)}
          <tr className="row-new" onClick={onCompose}><td colSpan="5"><span>{Icon.plus}</span>新規</td></tr>
        </tbody>
        <tfoot><tr><td colSpan="5">カウント <b>{items.length}</b></td></tr></tfoot>
      </table>
    </div>
  </div>
}

function Report({ items }) {
  const chosen = items.slice(0, 5)
  return <>
    <div className="block callout gray"><span className="callout-ico">📣</span><p>レポートの下書きです。メモが増えるほど、内容を組み立てやすくなります。</p></div>
    <h2 className="block-h2">要点のまとめ</h2>
    <p className="block-p">以下のメモをもとに、内容を組み立てます。</p>
    {chosen.map((item, index) => <div className="numbered" key={item.id}>
      <span className="num">{index + 1}.</span>
      <div><p className="num-title">{item.title}</p><p className="num-body">{item.body || '内容を追加してください。'}</p></div>
    </div>)}
    <blockquote className="block-quote">日々の記録が、次の判断をつくる。</blockquote>
    <div className="add-block"><span>{Icon.plus}</span>クリックして下に追加</div>
  </>
}

function Composer({ draft, setDraft, onClose, onSave }) {
  return <div className="overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className="peek">
      <div className="peek-bar"><span className="peek-hint">新規ページ — メモ</span><button className="icon-btn" onClick={onClose} aria-label="閉じる">✕</button></div>
      <div className="peek-body">
        <input className="peek-title" autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="無題" />
        <div className="peek-props">
          <div className="prop"><span className="prop-label">{Icon.tag}タグ</span>
            <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}><option>メモ</option><option>アイデア</option><option>タスク</option></select></div>
          <div className="prop"><span className="prop-label">{Icon.tag}カテゴリ</span>
            <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="空" /></div>
        </div>
        <textarea className="peek-text" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="「/」でコマンドを入力するか、そのまま書き始めてください…" />
      </div>
      <div className="peek-foot"><button onClick={onClose}>キャンセル</button><button className="primary" onClick={onSave}>保存</button></div>
    </div>
  </div>
}

function Search({ query, setQuery, items, onClose, onPick }) {
  return <div className="overlay search-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className="search-modal">
      <div className="search-input-row"><span className="search-ico">{Icon.search}</span><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nitoronを検索…" /><kbd>Esc</kbd></div>
      <div className="search-results">
        <p className="search-section">{query ? '検索結果' : '最近のページ'}</p>
        {items.map((item) => <button key={item.id} onClick={onPick}>
          <span className="link-ico">{Icon.page}</span>
          <span className="sr-main"><strong>{item.title}</strong><span>メモ 内</span></span>
          <span className="sr-date">{item.date}</span>
        </button>)}
        {!items.length && <p className="no-hit">一致する結果はありません。</p>}
      </div>
      <div className="search-foot"><span><kbd>↑↓</kbd> 移動</span><span><kbd>⏎</kbd> 開く</span></div>
    </div>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
