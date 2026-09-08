import React from 'react'

export const NAV = [['discover', '発表を探す'], ['mine', '自分の記録'], ['challenges', '挑戦'], ['learning', '学習ノート'], ['compare', '比較']]
export default function SiteHeader({ view, name, ready, selectedCount, onCreate, onAccount }) {
  const current = id => view === id || id === 'mine' && view === 'record' || id === 'discover' && view === 'public'
  return <header className="site-header print-hidden">
    <div className="header-top">
      <a className="brand" href="#/discover" aria-label="Nitoron 発表を探す">nitoron<span>4H CLUB</span></a>
      <nav className="desktop-navigation" aria-label="メインナビゲーション">{NAV.map(([id, label]) => <a key={id} href={`#/${id}`} aria-current={current(id) ? 'page' : undefined}>{label}{id === 'compare' && selectedCount > 0 && <span className="nav-count">{selectedCount}</span>}</a>)}</nav>
      <div className="header-actions"><button className="create-link" disabled={!ready} onClick={onCreate}>発表を書く</button><button className="profile-control" onClick={onAccount} aria-label={name ? `${name}のアカウント` : 'アカウント・ログイン'}><span className="profile-avatar" aria-hidden="true">{name?.slice(0, 1) || 'N'}</span><span className="profile-label">{name || 'ログイン'}</span></button></div>
    </div>
  </header>
}
