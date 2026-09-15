import React, { useEffect, useRef, useState } from 'react'
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
// 検索ピル（ヘッダーの大きいピル）。2区画（機械・症状／地域）＋検索ボタン。条件は探すのチップ列右端の「絞り込み」へ。
export function SearchPill({ query, onQuery, region, onRegion, onSubmit, searchRef }) {
  return <form className="search-pill" role="search" aria-label="記録を検索" onSubmit={e => { e.preventDefault(); onSubmit() }}>
    <label className="search-part"><span>機械・症状</span><input ref={searchRef} type="search" maxLength={160} value={query} onChange={e => onQuery(e.target.value)} placeholder="型式・症状で探す" /></label>
    <label className="region-part"><span>地域</span><input type="search" maxLength={80} value={region} onChange={e => onRegion(e.target.value)} placeholder="すべての地域" /></label>
    <button className="search-submit" aria-label="検索する"><Icon name="search" size={21} /></button>
  </form>
}
// ヘッダーは上部に固定（sticky）。Airbnb と同じ開閉：
// ・探すの先頭では大きい検索ピルがヘッダーの2段目に開いている。下へ動かすと1段目の小さいピルに畳まれ、押すと再び開く（外側を押すと閉じる）。
// ・探す以外の画面は小さいピルだけ（押すと探すへ）。
// ・スマホは下へ動かすとヘッダーごと上へ滑って隠れ、上へ戻すと出る（下部ナビは main.jsx で同じ合図で出し入れ）。
// PC の1段目は Airbnb どおり中央リンクなし：ロゴ／小さいピル／「修理記録」／アバター。スマホはロゴと小さいピル（アバターは CSS で隠し、アカウントは下部タブ）。
export default function SiteHeader({ view, name, notify, search = null, chrome = { scrolled: false, hidden: false }, open = false, onOpen }) {
  const expanded = !!search && (!chrome.scrolled || open)
  // 先頭に戻ったら「押して開いた」状態を解く。下へ動かし始めたら閉じる（開いた直後のレイアウト変化によるスクロール補正は無視）。
  const openedAt = useRef(0)
  useEffect(() => { if (!chrome.scrolled) onOpen?.(false); else if (chrome.hidden && Date.now() - openedAt.current > 600) onOpen?.(false) }, [chrome.scrolled, chrome.hidden])
  const openSearch = () => {
    if (!search) { location.hash = '/discover'; return }
    openedAt.current = Date.now()
    onOpen?.(true)
    setTimeout(() => search.searchRef?.current?.focus({ preventScroll: true }), 280)
  }
  const label = search?.query?.trim() || '型式・症状で探す', regionLabel = search?.region?.trim() || 'すべての地域'
  // 外側を押すと閉じる幕。開いた直後の同じタップ（タッチ→クリックの二重発火）で閉じないよう、開いてから少し遅れて出す。
  const [backdrop, setBackdrop] = useState(false)
  useEffect(() => { if (!(search && open && chrome.scrolled)) { setBackdrop(false); return } const t = setTimeout(() => setBackdrop(true), 350); return () => clearTimeout(t) }, [search && open && chrome.scrolled])
  return <>
    <header className={`site-header print-hidden${expanded ? ' search-open' : ''}${chrome.scrolled ? ' is-scrolled' : ''}${chrome.hidden && !(search && open) ? ' is-hidden' : ''}`}>
      <div className="header-top">
        <a className="brand" href="#/discover" aria-label="Nitoron">nitoron</a>
        <button type="button" className="compact-search" onClick={openSearch} aria-expanded={search ? expanded : undefined} aria-label={search ? '検索を開く' : '記録を探す'} tabIndex={expanded ? -1 : 0}>
          <Icon name="search" size={16} /><span className="compact-main">{label}</span><span className="compact-sep" aria-hidden="true" /><span className="compact-region">{regionLabel}</span><span className="compact-go" aria-hidden="true"><Icon name="search" size={14} /></span>
        </button>
        <nav className="desktop-navigation" aria-label="メインナビゲーション">
          <a className="manage-link" href="#/repairs" aria-current={currentTab('repairs', view) ? 'page' : undefined}>修理記録</a>
        </nav>
        <div className="header-actions"><a className="profile-control" href="#/account" aria-label={notify ? 'アカウント（新着の指摘あり）' : 'アカウント'} aria-current={view === 'account' ? 'page' : undefined}><Icon name="menu" size={18} /><span className="profile-avatar">{name?.slice(0, 1) || <Icon name="user" size={20} />}</span>{notify && <i className="notify-dot static" aria-hidden="true" />}</a></div>
      </div>
      {search && <div className="header-search" aria-hidden={!expanded}><div className="header-search-inner"><SearchPill {...search} onSubmit={() => { onOpen?.(false); search.onSubmit() }} /></div></div>}
    </header>
    {backdrop && <div className="search-backdrop" onClick={() => onOpen?.(false)} aria-hidden="true" />}
  </>
}
