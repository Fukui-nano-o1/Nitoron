import React, { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { Dialog } from './ui.jsx'

// Airbnbの説明欄（本文を数行で畳み、続きはモーダルで読む）を参考にした表示。文章は各記録・プロフィールの投稿内容。
export default function Description({ id, heading, dialogTitle = heading, text, className }) {
  const ref = useRef(null)
  const [overflow, setOverflow] = useState(false), [open, setOpen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    // 画面幅で折り返し行数が変わるため、畳んだ高さを測って「もっと見る」の要否を決める。
    const observer = new ResizeObserver(() => setOverflow(el.scrollHeight - el.clientHeight > 1))
    observer.observe(el)
    return () => observer.disconnect()
  }, [text])
  if (!text?.trim()) return null
  return <section id={id} className={['about-section', className].filter(Boolean).join(' ')}>
    {heading && <h2>{heading}</h2>}
    <p ref={ref} className="about-clamp">{text}</p>
    {overflow && <button type="button" className="show-more print-hidden" onClick={() => setOpen(true)}>もっと見る<Icon name="right" size={14} /></button>}
    {open && <Dialog title={dialogTitle || '説明'} wide onClose={() => setOpen(false)}><p className="about-full">{text}</p></Dialog>}
  </section>
}
