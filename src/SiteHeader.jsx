import React from 'react'
import Icon from './Icon.jsx'
// 下部ナビの5項目（Airbnb と同じ並び）。探す・保存が閲覧側、修理記録が主作業、対話・アカウントが本人側。
// 自分の実践（発表）はアカウント→自分のページから開く。
export const NAV = [['discover', '探す', 'search'], ['saved', '保存', 'heart'], ['repairs', '修理記録', 'wrench'], ['talks', '対話', 'chat'], ['account', 'アカウント', 'user']]
// view は main.jsx の navView（record は修理記録なら 'repair'）。公開ページの修理記録は「探す」側に点灯する。
export const currentTab = (id, view) => ({
  discover: ['discover', 'public', 'user', 'compare'],
  saved: ['saved', 'list'],
  repairs: ['repairs', 'repair'],
  talks: ['talks'],
  account: ['account', 'mine', 'record'],
})[id]?.includes(view)
// PC は Airbnb どおり中央リンクなし：ロゴ／「修理記録」ピル／アバター。保存・対話はアバター→アカウント→自分のページから。
// スマホはロゴだけ（アバターは CSS で隠し、アカウントは下部タブ）。
export default function SiteHeader({ view, name, notify }) {
  return <header className="site-header print-hidden"><div className="header-top">
    <a className="brand" href="#/discover" aria-label="Nitoron">nitoron</a>
    <nav className="desktop-navigation" aria-label="メインナビゲーション">
      <a className="manage-link" href="#/repairs" aria-current={currentTab('repairs', view) ? 'page' : undefined}>修理記録</a>
    </nav>
    <div className="header-actions"><a className="profile-control" href="#/account" aria-label={notify ? 'アカウント（新着の指摘あり）' : 'アカウント'} aria-current={view === 'account' ? 'page' : undefined}><Icon name="menu" size={18} /><span className="profile-avatar">{name?.slice(0, 1) || <Icon name="user" size={20} />}</span>{notify && <i className="notify-dot static" aria-hidden="true" />}</a></div>
  </div></header>
}
