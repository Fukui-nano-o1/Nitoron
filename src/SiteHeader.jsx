import React from 'react'
import Icon from './Icon.jsx'
export const NAV = [['discover', '経営発表', 'search']]
export default function SiteHeader({ view, name, ready, notify, onCreate }) {
  return <header className="site-header print-hidden"><div className="header-top">
    <a className="brand" href="#/discover" aria-label="Nitoron 経営発表">nitoron</a>
    <nav className="desktop-navigation" aria-label="メインナビゲーション">{NAV.map(([id, label]) => <a key={id} href={`#/${id}`} aria-current={view === id || id === 'discover' && view === 'public' ? 'page' : undefined}>{label}</a>)}</nav>
    <div className="header-actions"><button className="create-link" disabled={!ready} onClick={onCreate}>発表を掲載する</button><a className="profile-control" href="#/account" aria-label={notify ? 'アカウント（新着の指摘あり）' : 'アカウント'} aria-current={view === 'account' ? 'page' : undefined}>{notify && <i className="notify-dot" aria-hidden="true" />}<Icon name="menu" size={18} /><span className="profile-avatar">{name?.slice(0, 1) || <Icon name="user" size={20} />}</span></a></div>
  </div></header>
}
