import React, { useEffect, useState } from 'react'
import { imageAttachments } from './attachment-domain.js'
import { safeUrl } from './domain.js'
import useAssets from './useAssets.js'
import Cover from './Cover.jsx'
import { Dialog, ErrorNotice } from './ui.jsx'

// スマホ幅かどうか。写真はスマホで横スワイプ、PCでモザイクに切り替える。
function useMobile() {
  const query = '(max-width: 760px)'
  const [mobile, setMobile] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches)
  useEffect(() => {
    const media = matchMedia(query), update = () => setMobile(media.matches)
    media.addEventListener('change', update); return () => media.removeEventListener('change', update)
  }, [])
  return mobile
}
// 写真なし＝プレースホルダーだけ、1枚＝カウンタなし、複数＝横スワイプ＋「n / 全体」カウンタ。タップで全画面ギャラリー。
export default function PhotoGallery({ record }) {
  const photos = imageAttachments(record), count = photos.length || (safeUrl(record.meta?.coverUrl) ? 1 : 0)
  const [open, setOpen] = useState(false), [index, setIndex] = useState(0)
  const mobile = useMobile()
  const onScroll = e => { const el = e.currentTarget; if (el.clientWidth) setIndex(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth)))) }
  return <>
    {mobile
      ? <div className={`photo-carousel photo-count-${Math.min(count, 5)}`}>
        {count ? <div className="photo-track" onScroll={onScroll} aria-label={`写真 ${count}枚`}>{Array.from({ length: count }, (_, i) => <button key={i} onClick={() => setOpen(true)} aria-label={`写真${i + 1}を全画面で表示`}><Cover record={record} index={i} eager={i === 0} /></button>)}</div> : <Cover record={record} />}
        {count > 1 && <span className="photo-counter" aria-live="polite">{index + 1} / {count}</span>}
      </div>
      : <div className={`photo-mosaic photo-count-${Math.min(count, 5)}`}>
        {count ? Array.from({ length: Math.min(count, 5) }, (_, i) => <button key={i} onClick={() => setOpen(true)} aria-label={`写真${i + 1}を大きく表示`}><Cover record={record} index={i} eager={i === 0} /></button>) : <Cover record={record} />}
        {count > 0 && <button className="show-photos" onClick={() => setOpen(true)}>写真をすべて見る（{count}）</button>}
      </div>}
    {open && <Dialog title={`写真（${count}）`} wide className="gallery" onClose={() => setOpen(false)}><GalleryItems record={record} /></Dialog>}
  </>
}
function GalleryItems({ record }) {
  const photos = imageAttachments(record), { urls, error, retry } = useAssets(photos)
  return <div className="gallery-items">{error && <ErrorNotice retry={retry}>{error}</ErrorNotice>}{photos.length ? photos.map(a => <figure key={a.path}>{urls[a.path] && <img src={urls[a.path]} alt={a.caption || a.name} />}<figcaption>{a.caption || a.name}</figcaption></figure>) : <img src={safeUrl(record.meta?.coverUrl)} alt={record.title} />}</div>
}
