import React, { useState } from 'react'
import RecordBody from './RecordBody.jsx'
import PhotoGallery from './PhotoGallery.jsx'
import RecordMemo from './RecordMemo.jsx'
import Icon from './Icon.jsx'
import { Dialog } from './ui.jsx'
import { KINDS, METRICS, number } from './domain.js'
import { imageAttachments, sanitizeAttachments } from './attachment-domain.js'
// 発表詳細。主操作は「この実践を試す」（スマホの下部固定バーとPCの右カードで同じ）。
// カードから外した操作の置き場：比較・自分だけのメモは「その他」メニュー、フォローは発表者セクション、
// 質問・指摘は対話欄への入口（右カードとハイライト行）。
// preview: 確認画面での「公開したときの見え方」。表示だけで、保存・フォロー・挑戦作成・対話などのデータ更新は一切起きない。
// editHref: 所有者にだけ渡す「編集する」の遷移先。
export default function PublicRecord({ record, onBack, selected, onSelect, saved, onSave, onShare, onDerive, deriving, ready, session, canFollow, following, onFollow, onAccount, notify, discussion, preview = false, editHref = null }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const m = record.meta, count = m?.observations.filter(o => o.fact.trim()).length || 0
  const photos = imageAttachments(record).length, files = sanitizeAttachments(m?.attachments).length - photos
  const hasNumbers = METRICS.some(([key]) => number(m?.[key]) !== null)
  const author = m?.author || '発表者', kind = KINDS[m?.kind || 'memo']
  const back = onBack ? <button onClick={onBack} aria-label="一覧へ戻る"><Icon name="left" size={16} /><span>一覧へ戻る</span></button> : <a href="#/discover" aria-label="発表を探す"><Icon name="left" size={16} /><span>発表を探す</span></a>
  const editLink = editHref && <a className="text-action owner-edit" href={editHref}><Icon name="pencil" size={16} />編集する</a>
  const tryButton = <button className="primary" disabled={!ready || deriving} onClick={onDerive}>{deriving ? '挑戦記録を作成中…' : 'この実践を試す'}</button>
  const toDiscussion = e => { e.preventDefault(); document.getElementById('discussion')?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }
  // 「その他」メニューからログイン案内へ進むときは、メニューを閉じてから開く（モーダルを重ねない）。
  const accountFromMore = () => { setMoreOpen(false); onAccount() }
  if (preview) return <article className="listing-page preview" aria-label="公開プレビュー">
    <header className="listing-title"><span className="listing-kind">{kind}</span><h1>{record.title}</h1><div className="listing-subtitle"><span>{[m?.region, m?.crop, m?.variety].filter(Boolean).join(' · ')}</span><span className="preview-tag">{kind}</span></div></header>
    <div className="listing-hero"><PhotoGallery record={record} /></div>
    <div className="listing-columns"><div className="listing-main"><div className="author-section"><div><h2>{author}さんの経営発表</h2><p>{[m?.club, m?.region].filter(Boolean).join(' · ') || '4Hクラブの実践記録'}</p></div><span className="avatar-circle large" aria-hidden="true">{author.slice(0, 1)}</span></div>
      <div className="record-facts"><div><strong>{[m?.crop, m?.variety].filter(Boolean).join(' ') || '作物未記録'}</strong><span>作物</span></div><div><strong>{count}件</strong><span>観測した事実</span></div><div><strong>{record.date}</strong><span>記録日</span></div></div>
      <div className="listing-highlights">
        {count > 0 && <div><Icon name="check" size={24} /><div><strong>観測した事実が{count}件</strong><small>日付・条件・根拠つきで記録された事実です。</small></div></div>}
        {hasNumbers && <div><Icon name="compare" size={24} /><div><strong>経営の数字を記録</strong><small>売上・経費などを、ほかの発表と並べて比べられます。</small></div></div>}
        {(photos > 0 || files > 0) && <div><Icon name="file" size={24} /><div><strong>{[photos > 0 && `写真${photos}枚`, files > 0 && `資料${files}点`].filter(Boolean).join('・')}を掲載</strong><small>現場の写真と裏づけ資料をそのまま確認できます。</small></div></div>}
        <div><Icon name="chat" size={24} /><div><strong>発表者と対話できる</strong><small>気になる条件や結果は、質問・指摘で直接確かめられます。</small></div></div>
      </div>
      <RecordBody record={record} hideHeading hideCover />
    </div></div>
    <div className="publication-date">公開版の更新：{String(record.publication?.updatedAt || '').slice(0, 10) || '未公開'}</div>
  </article>
  return <article className="listing-page">
    <div className="listing-back print-hidden">{back}<span>{editLink}{kind}</span></div>
    <header className="listing-title"><span className="listing-kind">{kind}</span><h1>{record.title}</h1><div className="listing-subtitle"><span>{[m?.region, m?.crop, m?.variety].filter(Boolean).join(' · ')}</span><div className="actions print-hidden"><button className="text-action" onClick={onShare}><Icon name="share" size={18} />共有</button><button className="text-action" aria-pressed={saved} onClick={onSave}><Icon name="heart" size={18} fill={saved ? 'currentColor' : 'none'} />{saved ? '保存済み' : '保存'}</button><button className="text-action" aria-haspopup="dialog" onClick={() => setMoreOpen(true)}><Icon name="menu" size={18} />その他</button></div></div></header>
    <div className="listing-hero"><PhotoGallery record={record} />
      <div className="hero-overlay print-hidden">{back}<div><button onClick={onShare} aria-label="共有"><Icon name="share" size={18} /></button><button aria-pressed={saved} onClick={onSave} aria-label={saved ? '保存リストから外す' : '保存リストに追加'}><Icon name="heart" size={18} fill={saved ? '#ff385c' : 'none'} color={saved ? '#ff385c' : undefined} /></button><button aria-haspopup="dialog" aria-label="その他の操作" onClick={() => setMoreOpen(true)}><Icon name="menu" size={18} /></button>{editHref && <a href={editHref} aria-label="編集する"><Icon name="pencil" size={18} /></a>}</div></div>
    </div>
    <div className="listing-columns"><div className="listing-main"><div className="author-section"><div><h2>{author}さんの経営発表</h2><p>{[m?.club, m?.region].filter(Boolean).join(' · ') || '4Hクラブの実践記録'}</p>{canFollow && <button className="text-action follow-button print-hidden" aria-pressed={following} onClick={onFollow}><Icon name="user-plus" size={16} />{following ? 'フォロー中' : 'フォローする'}</button>}</div><a className="avatar-circle large" href={`#/user/${record.publication.owner}`} aria-label={`${author}のプロフィールを表示`}>{author.slice(0, 1)}</a></div>
      <div className="record-facts"><div><strong>{[m?.crop, m?.variety].filter(Boolean).join(' ') || '作物未記録'}</strong><span>作物</span></div><div><strong>{count}件</strong><span>観測した事実</span></div><div><strong>{record.date}</strong><span>記録日</span></div></div>
      <div className="listing-highlights">
        {count > 0 && <div><Icon name="check" size={24} /><div><strong>観測した事実が{count}件</strong><small>日付・条件・根拠つきで記録された事実です。</small></div></div>}
        {hasNumbers && <div><Icon name="compare" size={24} /><div><strong>経営の数字を記録</strong><small>売上・経費などを、ほかの発表と並べて比べられます。</small></div></div>}
        {(photos > 0 || files > 0) && <div><Icon name="file" size={24} /><div><strong>{[photos > 0 && `写真${photos}枚`, files > 0 && `資料${files}点`].filter(Boolean).join('・')}を掲載</strong><small>現場の写真と裏づけ資料をそのまま確認できます。</small></div></div>}
        <div><Icon name="chat" size={24} /><div><strong>発表者と対話できる</strong><small>気になる条件や結果は、<a href="#discussion" onClick={toDiscussion}>質問・指摘</a>で直接確かめられます。</small></div></div>
      </div>
      <RecordBody record={record} hideHeading hideCover />
    </div><aside className="listing-aside print-hidden"><div className="action-card"><h2>この実践から、次の一歩</h2><div className="action-conditions"><div><span>作物</span><strong>{m?.crop || '未記録'}</strong></div><div><span>対象面積</span><strong>{m?.areaA ? `${m.areaA} a` : '未記録'}</strong></div><div><span>対象期間</span><strong>{m?.start || '未記録'} 〜 {m?.end || '未記録'}</strong></div></div>
        {tryButton}<p>自分の挑戦記録として作物と参照元を引き継ぎます。元の発表は変わりません。</p>
        <div className="action-list">
          <a className="action-row" href="#discussion" onClick={toDiscussion}><span className="action-icon"><Icon name="chat" size={20} /></span><span><strong>質問・指摘を送る</strong><small>このページの対話欄へ移動します。</small></span></a>
          <button className="action-row" aria-haspopup="dialog" onClick={() => setMoreOpen(true)}><span className="action-icon"><Icon name="menu" size={20} /></span><span><strong>その他</strong><small>ほかの記録との比較、自分だけのメモ。</small></span></button>
          {editHref && <a className="action-row" href={editHref}><span className="action-icon"><Icon name="pencil" size={20} /></span><span><strong>編集する</strong><small>自分の発表です。下書きを編集して公開版を更新できます。</small></span></a>}
        </div></div><button className="text-action print-button" onClick={() => window.print()}>印刷・PDFに保存</button></aside></div>
    {discussion}<div className="publication-date">公開版の更新：{record.publication.updatedAt.slice(0, 10)}</div>
    {moreOpen && <Dialog title="その他の操作" onClose={() => setMoreOpen(false)}><div className="action-list more-menu">
      <button className="action-row" aria-pressed={selected} onClick={onSelect}><span className="action-icon"><Icon name={selected ? 'check' : 'compare'} size={20} /></span><span><strong>{selected ? '比較から外す' : 'ほかの記録と比較する'}</strong><small>{selected ? '比較に選択中です。' : '3件まで選んで、条件と数字を並べられます。'}</small></span></button>
      <RecordMemo record={record} session={session} onAccount={accountFromMore} notify={notify} />
    </div></Dialog>}
    <div className="listing-mobile-action print-hidden"><div><strong>{[m?.crop, m?.areaA ? `${m.areaA} a` : ''].filter(Boolean).join(' · ') || kind}</strong><button className="text-action" aria-pressed={saved} onClick={onSave}>{saved ? '保存済み' : '保存する'}</button></div>{tryButton}</div>
  </article>
}
