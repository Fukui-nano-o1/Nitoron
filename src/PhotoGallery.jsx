import React, { useEffect, useRef, useState } from 'react'
import { imageAttachments } from './attachment-domain.js'
import { safeUrl } from './domain.js'
import useAssets from './useAssets.js'
import Cover from './Cover.jsx'
import Icon from './Icon.jsx'
import { Dialog, ErrorNotice } from './ui.jsx'

function useMobile() {
  const query = '(max-width: 760px)'
  const [mobile, setMobile] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches)
  useEffect(() => {
    const media = matchMedia(query), update = () => setMobile(media.matches)
    media.addEventListener('change', update); return () => media.removeEventListener('change', update)
  }, [])
  return mobile
}

// The selected mosaic tile or mobile slide is also the first image in the viewer.
export default function PhotoGallery({ record }) {
  const photos = imageAttachments(record), count = photos.length || (safeUrl(record.meta?.coverUrl) ? 1 : 0)
  const [openedIndex, setOpenedIndex] = useState(null), [index, setIndex] = useState(0)
  const mobile = useMobile()
  useEffect(() => { setOpenedIndex(null); setIndex(0) }, [record.id])
  const onScroll = e => { const el = e.currentTarget; if (el.clientWidth) setIndex(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth)))) }
  return <>
    {mobile
      ? <div className={`photo-carousel photo-count-${Math.min(count, 5)}`}>
        {count ? <div className="photo-track" onScroll={onScroll} aria-label={`写真 ${count}枚`}>{Array.from({ length: count }, (_, i) => <button type="button" key={i} onClick={() => setOpenedIndex(i)} aria-haspopup="dialog" aria-label={`写真${i + 1}を全画面で表示`}><Cover record={record} index={i} eager={i === 0} /></button>)}</div> : <Cover record={record} />}
        {count > 1 && <span className="photo-counter" aria-live="polite">{index + 1} / {count}</span>}
      </div>
      : <div className={`photo-mosaic photo-count-${Math.min(count, 5)}`}>
        {count ? Array.from({ length: Math.min(count, 5) }, (_, i) => <button type="button" key={i} onClick={() => setOpenedIndex(i)} aria-haspopup="dialog" aria-label={`写真${i + 1}を大きく表示`}><Cover record={record} index={i} eager={i === 0} /></button>) : <Cover record={record} />}
        {count > 0 && <button type="button" className="show-photos" aria-haspopup="dialog" onClick={() => setOpenedIndex(0)}>写真をすべて見る（{count}）</button>}
      </div>}
    {openedIndex !== null && <Dialog title="写真" wide className="gallery photo-viewer" onClose={() => setOpenedIndex(null)}><GalleryItems key={record.id} record={record} initialIndex={openedIndex} /></Dialog>}
  </>
}

function GalleryItems({ record, initialIndex }) {
  const photos = imageAttachments(record), { urls, error, retry } = useAssets(photos)
  const count = photos.length || 1
  const [index, setIndex] = useState(Math.min(initialIndex, count - 1))
  const [failed, setFailed] = useState('')
  const touchStart = useRef(null), thumbs = useRef(null)
  const photo = photos[index]
  const url = photo ? urls[photo.path] : safeUrl(record.meta?.coverUrl)
  const caption = photo?.caption || photo?.name || record.title
  const move = direction => setIndex(current => Math.max(0, Math.min(count - 1, current + direction)))
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = event => {
      if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      if (event.key === 'Home') setIndex(0)
      else if (event.key === 'End') setIndex(count - 1)
      else setIndex(current => Math.max(0, Math.min(count - 1, current + (event.key === 'ArrowLeft' ? -1 : 1))))
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown) }
  }, [count])
  useEffect(() => {
    const selected = thumbs.current?.children[index]
    if (!selected) return
    const left = selected.offsetLeft - (thumbs.current.clientWidth - selected.clientWidth) / 2
    thumbs.current.scrollTo({ left, behavior: 'instant' })
  }, [index])
  const finishSwipe = event => {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) move(dx < 0 ? 1 : -1)
  }
  return <div className="photo-viewer-content">
    <div className="photo-viewer-status" aria-live="polite" aria-atomic="true">{index + 1} / {count}</div>
    {error && <ErrorNotice retry={retry}>{error}</ErrorNotice>}
    <div className="photo-viewer-stage" onPointerDown={event => { if (event.pointerType === 'touch' && event.isPrimary) touchStart.current = { x: event.clientX, y: event.clientY } }} onPointerUp={finishSwipe} onPointerCancel={() => { touchStart.current = null }}>
      {count > 1 && <button type="button" className="viewer-arrow viewer-prev" aria-label="前の写真" aria-keyshortcuts="ArrowLeft" disabled={index === 0} onClick={() => move(-1)}><Icon name="left" size={22} /></button>}
      <figure aria-label={`写真 ${index + 1} / ${count}`}>
        {url && failed !== url ? <img key={url} src={url} alt={caption} referrerPolicy="no-referrer" draggable="false" onError={() => setFailed(url)} /> : <div className="photo-viewer-placeholder" role="status">{failed === url || error ? '写真を取得できません' : '写真を読み込み中…'}</div>}
        <figcaption>{caption}</figcaption>
      </figure>
      {count > 1 && <button type="button" className="viewer-arrow viewer-next" aria-label="次の写真" aria-keyshortcuts="ArrowRight" disabled={index === count - 1} onClick={() => move(1)}><Icon name="right" size={22} /></button>}
    </div>
    {count > 1 && <div className="photo-viewer-thumbs" ref={thumbs} aria-label="写真を選ぶ">{photos.map((item, i) => <button type="button" key={item.path} aria-label={`写真${i + 1}を表示`} aria-pressed={index === i} onClick={() => setIndex(i)}>{urls[item.path] ? <img src={urls[item.path]} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span>{i + 1}</span>}</button>)}</div>}
  </div>
}
