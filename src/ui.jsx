import React, { useEffect, useRef, useId } from 'react'
export function Dialog({ title, children, onClose, wide = false, className = '' }) {
  const ref = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current, previous = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); previous?.focus?.() }
  }, [])
  return <dialog ref={ref} className={`dialog ${wide ? 'wide' : ''} ${className}`} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose() }} onClick={e => { if (e.target === ref.current) { const r = ref.current.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() } }}>
    <div className="dialog-head"><h2 id={titleId}>{title}</h2><button className="quiet" onClick={onClose} aria-label="閉じる">閉じる</button></div>{children}
  </dialog>
}
export function Field({ label, help, children }) {
  return <label className="field"><span>{label}</span>{children}{help && <small>{help}</small>}</label>
}
export function Empty({ title, children, action }) {
  return <div className="empty"><h2>{title}</h2>{children && <p>{children}</p>}{action}</div>
}
export function ErrorNotice({ children, retry }) {
  return <div className="notice error" role="alert"><span>{children}</span>{retry && <button onClick={retry}>再試行</button>}</div>
}
export function download(name, content, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a'); link.href = url; link.download = name.replace(/[\\/:*?"<>|]/g, '_'); link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
