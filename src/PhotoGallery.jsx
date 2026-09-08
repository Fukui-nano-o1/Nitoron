import React, { useState } from 'react'
import { imageAttachments } from './attachment-domain.js'
import { safeUrl } from './domain.js'
import useAssets from './useAssets.js'
import Cover from './Cover.jsx'
import { Dialog, ErrorNotice } from './ui.jsx'
export default function PhotoGallery({ record }) {
  const photos = imageAttachments(record), count = photos.length || (safeUrl(record.meta?.coverUrl) ? 1 : 0)
  const [open, setOpen] = useState(false)
  return <>
    <div className={`photo-mosaic photo-count-${Math.min(count, 5)}`}>
      {count ? Array.from({ length: Math.min(count, 5) }, (_, i) => <button key={i} onClick={() => setOpen(true)} aria-label={`写真${i + 1}を大きく表示`}><Cover record={record} index={i} eager={i === 0} /></button>) : <Cover record={record} />}
      {count > 0 && <button className="show-photos" onClick={() => setOpen(true)}>写真をすべて見る（{count}）</button>}
    </div>
    {open && <Dialog title="写真" wide onClose={() => setOpen(false)}><GalleryItems record={record} /></Dialog>}
  </>
}
function GalleryItems({ record }) {
  const photos = imageAttachments(record), { urls, error, retry } = useAssets(photos)
  return <div className="gallery-items">{error && <ErrorNotice retry={retry}>{error}</ErrorNotice>}{photos.length ? photos.map(a => <figure key={a.path}>{urls[a.path] && <img src={urls[a.path]} alt={a.caption || a.name} />}<figcaption>{a.caption || a.name}</figcaption></figure>) : <img src={safeUrl(record.meta?.coverUrl)} alt={record.title} />}</div>
}
