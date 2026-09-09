import React from 'react'
import Icon from './Icon.jsx'
// 下部ナビの5項目。探す・保存・対話が閲覧側、自分の実践が発表管理側。
export const NAV = [['discover', '探す', 'search'], ['saved', '保存', 'heart'], ['mine', '自分の実践', 'book'], ['talks', '対話', 'chat'], ['account', 'アカウント', 'user']]
export const currentTab = (id, view) => id === view || id === 'discover' && ['public', 'user', 'compare'].includes(view) || id === 'mine' && view === 'record' || id === 'account' && view === 'profile'
export default function SiteHeader({ view, name, notify }) {
  return <header className="site-header print-hidden"><div className="header-top">
    <a className="brand" href="#/discover" aria-label="Nitoron 経営発表">nitoron</a>
    <nav className="desktop-navigation" aria-label="メインナビゲーション">
      {[['discover', '探す'], ['saved', '保存'], ['talks', '対話']].map(([id, label]) => <a key={id} href={`#/${id}`} aria-current={currentTab(id, view) ? 'page' : undefined}>{id === 'talks' && notify && <i className="notify-dot static" aria-hidden="true" />}{label}</a>)}
      <i className="nav-divider" aria-hidden="true" />
      <a className="manage-link" href="#/mine" aria-current={currentTab('mine', view) ? 'page' : undefined}>自分の実践</a>
    </nav>
    <div className="header-actions"><a className="profile-control" href="#/account" aria-label="アカウント" aria-current={view === 'account' ? 'page' : undefined}><Icon name="menu" size={18} /><span className="profile-avatar">{name?.slice(0, 1) || <Icon name="user" size={20} />}</span></a></div>
  </div></header>
}
