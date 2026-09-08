import React, { useState } from 'react'
import Icon from './Icon.jsx'
export const NAV = [['discover', '探す', 'search'], ['saved', '保存リスト', 'heart'], ['mine', '自分の記録', 'book'], ['compare', '比較', 'compare']]
export default function SiteHeader({ view, name, ready, selectedCount, onCreate, onAccount }) {
  const [menu, setMenu] = useState(false)
  return <header className="site-header print-hidden"><div className="header-top">
    <a className="brand" href="#/discover" aria-label="Nitoron 発表を探す">nitoron</a>
    <nav className="desktop-navigation" aria-label="メインナビゲーション">{[['discover', '経営発表']].map(([id, label]) => <a key={id} href={`#/${id}`} aria-current={view === id || id === 'discover' && view === 'public' ? 'page' : undefined}>{label}</a>)}</nav>
    <div className="header-actions"><button className="create-link" disabled={!ready} onClick={onCreate}>発表を掲載する</button><a className="header-save" href="#/saved" aria-label="保存リスト"><Icon name="heart" /></a><button className="profile-control" aria-expanded={menu} aria-label="アカウントメニュー" onClick={() => setMenu(!menu)}><Icon name="menu" size={18} /><span className="profile-avatar">{name?.slice(0, 1) || <Icon name="user" size={20} />}</span></button></div>
    {menu && <><button className="menu-backdrop" aria-label="メニューを閉じる" onClick={() => setMenu(false)} /><nav className="account-menu" aria-label="自分のメニュー">{NAV.filter(([id]) => id !== 'discover').map(([id, label]) => <a key={id} href={`#/${id}`} onClick={() => setMenu(false)}>{label}{id === 'compare' && selectedCount > 0 ? `（${selectedCount}）` : ''}</a>)}<button onClick={() => { setMenu(false); onAccount() }}>{name || 'ログイン・登録'}</button></nav></>}
  </div></header>
}
