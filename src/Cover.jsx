import React, { useState } from 'react'
import { safeUrl } from './domain.js'

export default function Cover({ record, className = '', eager = false }) {
  const [failed, setFailed] = useState('')
  const url = safeUrl(record.meta?.coverUrl)
  const crop = record.meta?.crop || record.category
  return <div className={`record-cover ${className} ${url && failed !== url ? 'has-photo' : 'without-photo'}`}>
    {url && failed !== url
      ? <img src={url} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(url)} />
      : <div className="cover-type"><span>FIELD NOTES</span><strong>{crop && crop !== '未分類' ? crop : '日々の記録'}</strong><span>{record.meta?.region || 'Nitoron / 4H Club'}</span></div>}
  </div>
}
