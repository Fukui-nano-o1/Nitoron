import React from 'react'
import RecordBody from './RecordBody.jsx'
import PhotoGallery from './PhotoGallery.jsx'
import RecordMemo from './RecordMemo.jsx'
import Icon from './Icon.jsx'
import { KINDS, METRICS, number } from './domain.js'
import { imageAttachments, sanitizeAttachments } from './attachment-domain.js'
// 発表詳細。主操作は「この実践を試す」（スマホの下部固定バーとPCの右カードで同じ）。
// カードから外した比較・質問・メモ・フォローは、右カード（スマホでは本文の下）に入口をまとめる。
export default function PublicRecord({ record, onBack, selected, onSelect, saved, onSave, onShare, onDerive, deriving, ready, session, canFollow, following, onFollow, onAccount, notify, discussion }) {
  const m = record.meta, count = m?.observations.filter(o => o.fact.trim()).length || 0
  const photos = imageAttachments(record).length, files = sanitizeAttachments(m?.attachments).length - photos
  const hasNumbers = METRICS.some(([key]) => number(m?.[key]) !== null)
  const author = m?.author || '発表者', kind = KINDS[m?.kind || 'memo']
  const back = onBack ? <button onClick={onBack} aria-label="一覧へ戻る"><Icon name="left" size={16} /><span>一覧へ戻る</span></button> : <a href="#/discover" aria-label="発表を探す"><Icon name="left" size={16} /><span>発表を探す</span></a>
  const tryButton = <button className="primary" disabled={!ready || deriving} onClick={onDerive}>{deriving ? '挑戦記録を作成中…' : 'この実践を試す'}</button>
  return <article className="listing-page">
    <div className="listing-back print-hidden">{back}<span>{kind}</span></div>
    <header className="listing-title"><span className="listing-kind">{kind}</span><h1>{record.title}</h1><div className="listing-subtitle"><span>{[m?.region, m?.crop, m?.variety].filter(Boolean).join(' · ')}</span><div className="actions print-hidden"><button className="text-action" onClick={onShare}><Icon name="share" size={18} />共有</button><button className="text-action" aria-pressed={saved} onClick={onSave}><Icon name="heart" size={18} fill={saved ? 'currentColor' : 'none'} />{saved ? '保存済み' : '保存'}</button></div></div></header>
    <div className="listing-hero"><PhotoGallery record={record} />
      <div className="hero-overlay print-hidden">{back}<div><button onClick={onShare} aria-label="共有"><Icon name="share" size={18} /></button><button aria-pressed={saved} onClick={onSave} aria-label={saved ? '保存リストから外す' : '保存リストに追加'}><Icon name="heart" size={18} fill={saved ? '#ff385c' : 'none'} color={saved ? '#ff385c' : undefined} /></button></div></div>
    </div>
    <div className="listing-columns"><div className="listing-main"><div className="author-section"><div><h2>{author}さんの経営発表</h2><p>{[m?.club, m?.region].filter(Boolean).join(' · ') || '4Hクラブの実践記録'}</p>{canFollow && <button className="text-action follow-button print-hidden" aria-pressed={following} onClick={onFollow}><Icon name="user-plus" size={16} />{following ? 'フォロー中' : 'フォローする'}</button>}</div><a className="avatar-circle large" href={`#/user/${record.publication.owner}`} aria-label={`${author}のプロフィールを表示`}>{author.slice(0, 1)}</a></div>
      <div className="record-facts"><div><strong>{[m?.crop, m?.variety].filter(Boolean).join(' ') || '作物未記録'}</strong><span>作物</span></div><div><strong>{count}件</strong><span>観測した事実</span></div><div><strong>{record.date}</strong><span>記録日</span></div></div>
      <div className="listing-highlights">
        {count > 0 && <div><Icon name="check" size={24} /><div><strong>観測した事実が{count}件</strong><small>日付・条件・根拠つきで記録された事実です。</small></div></div>}
        {hasNumbers && <div><Icon name="compare" size={24} /><div><strong>経営の数字を記録</strong><small>売上・経費などを、ほかの発表と並べて比べられます。</small></div></div>}
        {(photos > 0 || files > 0) && <div><Icon name="file" size={24} /><div><strong>{[photos > 0 && `写真${photos}枚`, files > 0 && `資料${files}点`].filter(Boolean).join('・')}を掲載</strong><small>現場の写真と裏づけ資料をそのまま確認できます。</small></div></div>}
        <div><Icon name="chat" size={24} /><div><strong>発表者と対話できる</strong><small>気になる条件や結果は、<a href="#discussion" onClick={e => { e.preventDefault(); document.getElementById('discussion')?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }}>質問・指摘</a>で直接確かめられます。</small></div></div>
      </div>
      <RecordBody record={record} hideHeading hideCover />
    </div><aside className="listing-aside print-hidden"><div className="action-card"><h2>この実践から、次の一歩</h2><div className="action-conditions"><div><span>作物</span><strong>{m?.crop || '未記録'}</strong></div><div><span>対象面積</span><strong>{m?.areaA ? `${m.areaA} a` : '未記録'}</strong></div><div><span>対象期間</span><strong>{m?.start || '未記録'} 〜 {m?.end || '未記録'}</strong></div></div>
        {tryButton}<p>自分の挑戦記録として作物と参照元を引き継ぎます。元の発表は変わりません。</p>
        <div className="action-list">
          <button className="action-row" aria-pressed={selected} onClick={onSelect}><span className="action-icon"><Icon name={selected ? 'check' : 'compare'} size={20} /></span><span><strong>{selected ? '比較から外す' : 'ほかの記録と比較する'}</strong><small>{selected ? '比較に選択中です。' : '3件まで選んで、条件と数字を並べられます。'}</small></span></button>
          <a className="action-row" href="#discussion" onClick={e => { e.preventDefault(); document.getElementById('discussion')?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }}><span className="action-icon"><Icon name="chat" size={20} /></span><span><strong>質問・指摘を送る</strong><small>このページの対話欄へ移動します。</small></span></a>
          <RecordMemo record={record} session={session} onAccount={onAccount} notify={notify} />
          {canFollow && <button className="action-row" onClick={onFollow}><span className="action-icon"><Icon name="user-plus" size={20} /></span><span><strong>{following ? `${author}のフォローをやめる` : `${author}をフォローする`}</strong><small>{following ? 'フォロー中です。' : '発表者を覚えておき、次の発表を見つけやすくします。'}</small></span></button>}
          <a className="action-row" href={`#/user/${record.publication.owner}`}><span className="action-icon"><Icon name="user" size={20} /></span><span><strong>{author}の発表一覧</strong><small>この発表者のプロフィールを開きます。</small></span></a>
        </div></div><button className="text-action print-button" onClick={() => window.print()}>印刷・PDFに保存</button></aside></div>
    {discussion}<div className="publication-date">公開版の更新：{record.publication.updatedAt.slice(0, 10)}</div>
    <div className="listing-mobile-action print-hidden"><div><strong>{[m?.crop, m?.areaA ? `${m.areaA} a` : ''].filter(Boolean).join(' · ') || kind}</strong><button className="text-action" aria-pressed={saved} onClick={onSave}>{saved ? '保存済み' : '保存する'}</button></div>{tryButton}</div>
  </article>
}
