import React from 'react'
import RecordBody from './RecordBody.jsx'
import PhotoGallery from './PhotoGallery.jsx'
import Icon from './Icon.jsx'
import { KINDS } from './domain.js'
export default function PublicRecord({ record, selected, onSelect, saved, onSave, onShare, onDerive, ready, discussion }) {
  const m = record.meta, count = m?.observations.filter(o => o.fact.trim()).length || 0
  return <article className="listing-page">
    <div className="listing-back print-hidden"><a href="#/discover"><Icon name="left" size={16} />発表を探す</a><span>{KINDS[m?.kind || 'memo']}</span></div>
    <header className="listing-title"><h1>{record.title}</h1><div className="listing-subtitle"><span>{[m?.region, m?.crop, m?.variety].filter(Boolean).join(' · ')}</span><div className="actions print-hidden"><button className="text-action" onClick={onShare}><Icon name="share" size={18} />共有</button><button className="text-action" aria-pressed={saved} onClick={onSave}><Icon name="heart" size={18} fill={saved ? 'currentColor' : 'none'} />{saved ? '保存済み' : '保存'}</button></div></div></header>
    <PhotoGallery record={record} />
    <div className="listing-columns"><div className="listing-main"><div className="author-section"><div><h2>{[m?.crop, m?.region].filter(Boolean).join(' · ') || '経営発表'}</h2><p>{m?.club || '4Hクラブの実践記録'}</p></div><a className="avatar-circle large" href={`#/user/${record.publication.owner}`} aria-label={`${m?.author || '発表者'}のプロフィールを表示`}>{m?.author?.slice(0, 1) || 'N'}</a></div>
      <div className="record-facts"><div><strong>{m?.author}</strong><span>発表者</span></div><div><strong>{count}件</strong><span>観測した事実</span></div><div><strong>{record.date}</strong><span>記録日</span></div></div>
      <RecordBody record={record} hideHeading hideCover />
    </div><aside className="listing-aside print-hidden"><div className="action-card"><h2>この実践から、次の一歩</h2><div className="action-conditions"><div><span>作物</span><strong>{m?.crop || '未記録'}</strong></div><div><span>対象面積</span><strong>{m?.areaA ? `${m.areaA} a` : '未記録'}</strong></div><div><span>対象期間</span><strong>{m?.start || '未記録'} 〜 {m?.end || '未記録'}</strong></div></div><button className="text-action" aria-pressed={selected} onClick={onSelect}><Icon name="compare" size={18} />{selected ? '比較から外す' : 'ほかの記録と比較する'}</button></div><button className="text-action print-button" onClick={() => window.print()}>印刷・PDFに保存</button></aside></div>
    {discussion}<div className="publication-date">公開版の更新：{record.publication.updatedAt.slice(0, 10)}</div>
  </article>
}
