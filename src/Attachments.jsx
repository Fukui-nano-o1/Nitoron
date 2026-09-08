import React, { useRef, useState, useEffect } from 'react'
import { sanitizeAttachments, fileSize, ATTACHMENT_LIMIT } from './attachment-domain.js'
import { uploadAttachment, openAttachment } from './assets.js'
import useAssets from './useAssets.js'
import Icon from './Icon.jsx'
import { ErrorNotice, Field } from './ui.jsx'
export function AttachmentList({ attachments = [] }) {
  const files = sanitizeAttachments(attachments)
  const [error, setError] = useState(''), [busy, setBusy] = useState('')
  if (!files.length) return null
  return <section className="attachment-section"><h2>写真・発表資料</h2><div className="attachment-list">{files.map(a => <button key={a.path} className="attachment-download" disabled={busy === a.path} onClick={async () => { setBusy(a.path); setError(''); try { await openAttachment(a) } catch (e) { setError(e.message) } finally { setBusy('') } }}><Icon name="file" /><span><strong>{a.name}</strong><small>{a.caption || `${a.type === 'application/pdf' ? 'PDF' : '写真'} · ${fileSize(a.size)}`}</small></span><span>{busy === a.path ? '取得中…' : '↓'}</span></button>)}</div>{error && <ErrorNotice>{error}</ErrorNotice>}</section>
}
export default function Attachments({ record, session, flush, onChange, onBusy }) {
  const files = sanitizeAttachments(record.meta?.attachments)
  const { urls } = useAssets(files.filter(a => a.type.startsWith('image/')))
  const latest = useRef(record), input = useRef(null), alive = useRef(true)
  latest.current = record
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => { alive.current = true; return () => { alive.current = false; onBusy?.(false) } }, [])
  const update = list => onChange({ ...latest.current, meta: { ...latest.current.meta, attachments: list } })
  const upload = async e => {
    const chosen = Array.from(e.target.files || []); e.target.value = ''
    if (!chosen.length || busy) return
    setBusy(true); onBusy?.(true); setError('')
    try {
      if (chosen.length + files.length > ATTACHMENT_LIMIT) throw new Error('添付は1つの記録につき12件までです。')
      if (!session || !await flush()) throw new Error('記録をクラウドに保存してから添付してください。')
      for (const file of chosen) {
        if (!alive.current) break
        const asset = await uploadAttachment(file, record.id, session, sanitizeAttachments(latest.current.meta.attachments).length)
        const next = [...sanitizeAttachments(latest.current.meta.attachments), asset]
        const updated = { ...latest.current, meta: { ...latest.current.meta, attachments: next } }
        latest.current = updated; onChange(updated)
      }
      await flush()
    } catch (e) { if (alive.current) setError(e.message) }
    finally { if (alive.current) { setBusy(false); onBusy?.(false) } }
  }
  return <section className="upload-section"><div className="section-heading"><h2>写真・発表資料</h2><span className="hint">{files.length} / {ATTACHMENT_LIMIT}</span></div>
    <button className="upload-target" disabled={busy || files.length >= ATTACHMENT_LIMIT} onClick={() => input.current.click()}><Icon name="upload" size={30} /><strong>{busy ? '添付しています…' : '写真やPDFを追加'}</strong><span>写真は先頭の1枚をカバーに使用 · 1件20MBまで</span></button>
    <input hidden ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,application/pdf" onChange={upload} />
    {error && <ErrorNotice>{error}</ErrorNotice>}
    <div className="attachment-editor">{files.map((a, i) => <div className="attachment-row" key={a.path}>
      <div className="attachment-thumb">{urls[a.path] ? <img src={urls[a.path]} alt={a.caption || a.name} /> : <Icon name="file" size={28} />}</div>
      <div><strong>{a.name}</strong><small>{fileSize(a.size)}</small><Field label="説明"><input value={a.caption} maxLength={500} disabled={busy} onChange={e => update(files.map(x => x.path === a.path ? { ...x, caption: e.target.value } : x))} placeholder="撮影日、測った場所など" /></Field></div>
      <div className="attachment-buttons">{a.type.startsWith('image/') && i > 0 && <button className="quiet" disabled={busy} onClick={() => update([a, ...files.filter(x => x.path !== a.path)])}>カバーにする</button>}<button className="quiet" disabled={busy} onClick={() => update(files.filter(x => x.path !== a.path))}>記録から外す</button></div>
    </div>)}</div>
  </section>
}
