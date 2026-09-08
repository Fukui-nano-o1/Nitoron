import React from 'react'
import Icon from './Icon.jsx'

export default function Profile({ session, name, selectedCount, savedNew = 0, mineNew = 0, onAccount }) {
  const permanent = session?.user && !session.user.is_anonymous && session.user.email_confirmed_at
  return <section className="profile-page">
    <h1>アカウント</h1>
    <div className="profile-card">
      <span className="avatar-circle xl" aria-hidden="true">{name?.slice(0, 1) || <Icon name="user" size={40} />}</span>
      <strong>{name || '名前未登録'}</strong>
      <span className="profile-status">{permanent ? session.user.email : 'この端末の仮アカウント'}</span>
      <button className={permanent ? 'secondary' : 'primary'} onClick={onAccount}>{permanent ? 'アカウント設定' : '登録・ログイン'}</button>
    </div>
    {!permanent && <p className="profile-note">メールを登録すると、この端末の記録を引き継いで、別の端末からも開けます。</p>}
    <nav className="profile-menu" aria-label="自分のページ">
      {[['mine', '自分の記録', 'book', mineNew ? `新着の指摘 ${mineNew}件` : '書いた発表と下書き', mineNew],
        ['saved', '保存リスト', 'heart', savedNew ? `新着の指摘 ${savedNew}件` : 'ハートを付けた発表', savedNew],
        ['compare', '比較', 'compare', selectedCount ? `${selectedCount}件を選択中` : '発表を並べて比べる', 0]]
        .map(([id, label, icon, desc, alert]) => <a key={id} href={`#/${id}`}><Icon name={icon} size={24} /><span><strong>{label}</strong><small className={alert ? 'menu-new' : undefined}>{desc}</small></span>{!!alert && <i className="notify-dot static" aria-hidden="true" />}<Icon name="right" size={16} /></a>)}
    </nav>
  </section>
}
