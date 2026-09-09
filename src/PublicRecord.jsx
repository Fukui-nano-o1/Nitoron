import React from 'react'
import RecordBody from './RecordBody.jsx'
import PhotoGallery from './PhotoGallery.jsx'
import Icon from './Icon.jsx'
import { KINDS, METRICS, number } from './domain.js'
import { imageAttachments, sanitizeAttachments } from './attachment-domain.js'
export default function PublicRecord({ record, selected, onSelect, saved, onSave, onShare, onDerive, ready, discussion }) {
  const m = record.meta, count = m?.observations.filter(o => o.fact.trim()).length || 0
  const photos = imageAttachments(record).length, files = sanitizeAttachments(m?.attachments).length - photos
  const hasNumbers = METRICS.some(([key]) => number(m?.[key]) !== null)
  return <article className="listing-page">
    <div className="listing-back print-hidden"><a href="#/discover"><Icon name="left" size={16} />発表を探す</a><span>{KINDS[m?.kind || 'memo']}</span></div>
    <header className="listing-title"><h1>{record.title}</h1><div className="listing-subtitle"><span>{[m?.region, m?.crop, m?.variety].filter(Boolean).join(' · ')}</span><div className="actions print-hidden"><button className="text-action" onClick={onShare}><Icon name="share" size={18} />共有</button><button className="text-action" aria-pressed={saved} onClick={onSave}><Icon name="heart" size={18} fill={saved ? 'currentColor' : 'none'} />{saved ? '保存済み' : '保存'}</button></div></div></header>
    <PhotoGallery record={record} />
    <div className="listing-columns"><div className="listing-main"><div className="author-section"><div><h2>{m?.author || '発表者'}さんの経営発表</h2><p>{[m?.club, m?.region].filter(Boolean).join(' · ') || '4Hクラブの実践記録'}</p></div><a className="avatar-circle large" href={`#/user/${record.publication.owner}`} aria-label={`${m?.author || '発表者'}のプロフィールを表示`}>{m?.author?.slice(0, 1) || 'N'}</a></div>
      <div className="record-facts"><div><strong>{[m?.crop, m?.variety].filter(Boolean).join(' ') || '作物未記録'}</strong><span>作物</span></div><div><strong>{count}件</strong><span>観測した事実</span></div><div><strong>{record.date}</strong><span>記録日</span></div></div>
      <div className="listing-highlights">
        {count > 0 && <div><Icon name="check" size={24} /><div><strong>観測した事実が{count}件</strong><small>日付・条件・根拠つきで記録された事実です。</small></div></div>}
        {hasNumbers && <div><Icon name="compare" size={24} /><div><strong>経営の数字を記録</strong><small>売上・経費などを、ほかの発表と並べて比べられます。</small></div></div>}
        {(photos > 0 || files > 0) && <div><Icon name="file" size={24} /><div><strong>{[photos > 0 && `写真${photos}枚`, files > 0 && `資料${files}点`].filter(Boolean).join('・')}を掲載</strong><small>現場の写真と裏づけ資料をそのまま確認できます。</small></div></div>}
        <div><Icon name="chat" size={24} /><div><strong>発表者と対話できる</strong><small>気になる条件や結果は、質問・指摘で直接確かめられます。</small></div></div>
      </div>
      <RecordBody record={record} hideHeading hideCover />
    </div><aside className="listing-aside print-hidden"><div className="action-card"><h2>この実践から、次の一歩</h2><div className="action-conditions"><div><span>作物</span><strong>{m?.crop || '未記録'}</strong></div><div><span>対象面積</span><strong>{m?.areaA ? `${m.areaA} a` : '未記録'}</strong></div><div><span>対象期間</span><strong>{m?.start || '未記録'} 〜 {m?.end || '未記録'}</strong></div></div><button className="text-action" aria-pressed={selected} onClick={onSelect}><Icon name="compare" size={18} />{selected ? '比較から外す' : 'ほかの記録と比較する'}</button></div><button className="text-action print-button" onClick={() => window.print()}>印刷・PDFに保存</button></aside></div>
    {discussion}<div className="publication-date">公開版の更新：{record.publication.updatedAt.slice(0, 10)}</div>
    <div className="listing-mobile-action print-hidden"><div><strong>{[m?.crop, m?.areaA ? `${m.areaA} a` : ''].filter(Boolean).join(' · ') || KINDS[m?.kind || 'memo']}</strong><button className="text-action" aria-pressed={saved} onClick={onSave}>{saved ? '保存済み' : '保存する'}</button></div><button className="primary" aria-pressed={selected} onClick={onSelect}>{selected ? '比較から外す' : '比較に追加'}</button></div>
  </article>
}
