import React, { useState } from 'react'
import { safeUrl } from './domain.js'
import { imageAttachments } from './attachment-domain.js'
import useAssets from './useAssets.js'

export default function Cover({ record, className = '', eager = false, index = 0 }) {
  const [failed, setFailed] = useState('')
  const photos = imageAttachments(record), asset = photos[index]
  const { urls, error } = useAssets(asset ? [asset] : [])
  const url = asset ? urls[asset.path] : safeUrl(record.meta?.coverUrl)
  const crop = record.meta?.crop || record.category
  return <div className={`record-cover ${className} ${url && failed !== url ? 'has-photo' : 'without-photo'}`}>
    {url && failed !== url
      ? <img src={url} alt={asset?.caption || ''} loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(url)} />
      : <div className="cover-type"><span>{asset ? error || failed === url ? '写真を取得できません' : '写真を読み込み中' : '写真未登録'}</span><strong>{crop && crop !== '未分類' ? crop : '日々の記録'}</strong><span>{record.meta?.region || 'Nitoron / 4H Club'}</span></div>}
  </div>
}
