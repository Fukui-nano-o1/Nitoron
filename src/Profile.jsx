import React from 'react'
import Icon from './Icon.jsx'

export default function Profile({ session, name, selectedCount, onAccount }) {
  const permanent = session?.user && !session.user.is_anonymous && session.user.email_confirmed_at
  return <section className="profile-page">
    <h1>アカウント</h1>
    <div className="profile-summary">
      <span className="profile-avatar large">{name?.slice(0, 1) || <Icon name="user" size={22} />}</span>
      <div><strong>{name || '名前未登録'}</strong><p>{permanent ? session.user.email : 'この端末の仮アカウント'}</p></div>
      <button className="secondary" onClick={onAccount}>{permanent ? 'アカウント設定' : '登録・ログイン'}</button>
    </div>
    <nav className="profile-links" aria-label="自分のページ">
      {[['mine', '自分の記録', 'book', '書いた発表と下書き'],
        ['saved', '保存リスト', 'heart', 'ハートを付けた発表'],
        ['compare', '比較', 'compare', selectedCount ? `${selectedCount}件を選択中` : '発表を並べて比べる']]
        .map(([id, label, icon, desc]) => <a key={id} href={`#/${id}`}><Icon name={icon} size={22} /><span><strong>{label}</strong><small>{desc}</small></span><Icon name="right" size={16} /></a>)}
    </nav>
  </section>
}
