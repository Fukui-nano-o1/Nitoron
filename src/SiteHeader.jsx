import React, { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

export const NAV = [['discover', '探す', 'search'], ['saved', '保存', 'heart'], ['repairs', '修理記録', 'wrench'], ['talks', '対話', 'chat'], ['account', 'アカウント', 'user']]
export const currentTab = (id, view) => ({
  discover: ['discover', 'public', 'user', 'compare'],
  saved: ['saved', 'list'],
  repairs: ['repairs', 'repair'],
  talks: ['talks'],
  account: ['account', 'mine', 'record'],
})[id]?.includes(view)

export function SearchPill({ query, onQuery, region, onRegion, onSubmit, searchRef, enabled = true }) {
  return <form className="search-pill" role="search" aria-label="記録を検索" onSubmit={e => { e.preventDefault(); onSubmit() }}>
    <label className="search-part"><span>機械・症状</span><input ref={searchRef} type="search" maxLength={160} value={query} disabled={!enabled} onChange={e => onQuery(e.target.value)} placeholder="型式・症状で探す" /></label>
    <label className="region-part"><span>地域</span><input type="search" maxLength={80} value={region} disabled={!enabled} onChange={e => onRegion(e.target.value)} placeholder="すべての地域" /></label>
    <button className="search-submit" type="submit" disabled={!enabled} aria-label="検索する"><Icon name="search" size={21} /><span>検索</span></button>
  </form>
}

export default function SiteHeader({ view, name, notify, search = null, chrome = { scrolled: false, hidden: false }, open = false, onOpen }) {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches)
  const [menuOpen, setMenuOpen] = useState(false)
  const [hasFocus, setHasFocus] = useState(false)
  const headerRef = useRef(null), searchButtonRef = useRef(null), profileRef = useRef(null), menuRef = useRef(null)
  const openedAt = useRef(0)
  const expanded = !!search && (open || (!mobile && !chrome.scrolled))
  const showNavigation = !search || expanded
  const showBackdrop = !!search && open && (mobile || chrome.scrolled)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const update = () => setMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!mobile && !chrome.scrolled) onOpen?.(false)
    else if (chrome.hidden && Date.now() - openedAt.current > 600) onOpen?.(false)
  }, [chrome.scrolled, chrome.hidden, mobile, onOpen])
  useEffect(() => { setMenuOpen(false) }, [view])
  useEffect(() => {
    if (!open || !search) return
    const frame = requestAnimationFrame(() => search.searchRef?.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [open, search?.searchRef])
  useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector('a')?.focus({ preventScroll: true })
  }, [menuOpen])
  useEffect(() => {
    if (!menuOpen && !open) return
    const handleKey = e => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (menuOpen) { setMenuOpen(false); profileRef.current?.focus({ preventScroll: true }) }
      else { onOpen?.(false); requestAnimationFrame(() => searchButtonRef.current?.focus({ preventScroll: true })) }
    }
    const outside = e => {
      if (headerRef.current?.contains(e.target)) return
      setMenuOpen(false)
      onOpen?.(false)
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', handleKey); document.removeEventListener('pointerdown', outside) }
  }, [menuOpen, open, onOpen])

  const openSearch = () => {
    setMenuOpen(false)
    openedAt.current = Date.now()
    onOpen?.(true)
    if (!search) location.hash = '/discover'
  }
  const closeSearch = () => { onOpen?.(false); requestAnimationFrame(() => searchButtonRef.current?.focus({ preventScroll: true })) }
  const label = search?.query?.trim() || '型式・症状で探す'
  const regionLabel = search?.region?.trim() || 'すべての地域'

  return <>
    <header ref={headerRef} className={`site-header header-experience print-hidden${expanded ? ' search-open' : ''}${search ? ' has-search' : ' no-search'}${chrome.scrolled ? ' is-scrolled' : ''}${chrome.hidden && !open && !menuOpen && !hasFocus ? ' is-hidden' : ''}`} onFocusCapture={() => setHasFocus(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setHasFocus(false) }}>
      <div className="header-top">
        <a className="brand" href="#/discover" aria-label="Nitoron ホーム">nitoron</a>
        <div className="header-center">
          <nav className="desktop-navigation" aria-label="メインナビゲーション" hidden={!showNavigation}>
            {NAV.slice(0, 3).map(([id, text]) => <a key={id} href={`#/${id}`} aria-current={currentTab(id, view) ? 'page' : undefined}>{text}</a>)}
          </nav>
          <button ref={searchButtonRef} type="button" className="compact-search" onClick={openSearch} aria-expanded={search ? expanded : undefined} aria-controls={search ? 'header-search-panel' : undefined} aria-label={search ? '検索を開く' : '記録を探す'} tabIndex={!mobile && showNavigation ? -1 : 0}>
            <Icon name="search" size={20} />
            <span className="compact-copy"><span className="compact-main">{label}</span><span className="compact-mobile-subtitle">{regionLabel}</span></span>
            <span className="compact-sep" aria-hidden="true" /><span className="compact-region">{regionLabel}</span>
            <span className="compact-go" aria-hidden="true"><Icon name="search" size={14} /></span>
          </button>
        </div>
        <div className="header-actions">
          <a className="header-repair-link" href="#/repairs">修理記録をつける</a>
          <button ref={profileRef} type="button" className="profile-control" aria-label={notify ? 'アカウントメニュー（新着の指摘あり）' : 'アカウントメニュー'} aria-expanded={menuOpen} aria-controls="header-account-menu" onClick={() => { onOpen?.(false); setMenuOpen(value => !value) }}><Icon name="menu" size={18} /><span className="profile-avatar">{name?.slice(0, 1) || <Icon name="user" size={20} />}</span>{notify && <i className="notify-dot" aria-hidden="true" />}</button>
          {menuOpen && <nav ref={menuRef} id="header-account-menu" className="header-account-menu" aria-label="アカウントメニュー" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget) && e.relatedTarget !== profileRef.current) setMenuOpen(false) }}>
            {NAV.map(([id, text, icon]) => <a key={id} href={`#/${id}`} aria-current={currentTab(id, view) ? 'page' : undefined} onClick={() => setMenuOpen(false)}><Icon name={icon} size={19} /><span>{text}</span>{id === 'talks' && notify && <i className="menu-notify-dot" aria-label="新着の指摘あり" />}</a>)}
          </nav>}
        </div>
      </div>
      {search && <div id="header-search-panel" className="header-search" aria-hidden={!expanded} inert={!expanded}>
        <div className="header-search-inner">
          <div className="header-search-heading"><strong>記録を探す</strong><button type="button" onClick={closeSearch} aria-label="検索を閉じる"><Icon name="close" size={20} /></button></div>
          <SearchPill {...search} enabled={expanded} onSubmit={() => { onOpen?.(false); search.onSubmit() }} />
        </div>
      </div>}
    </header>
    {showBackdrop && <div className="search-backdrop" onClick={closeSearch} aria-hidden="true" />}
  </>
}
