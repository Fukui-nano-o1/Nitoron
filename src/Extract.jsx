import React, { useEffect, useRef, useState } from 'react'
import { importFile, IMPORT_ACCEPT } from './importers.js'
import { textBlock } from './domain.js'
import Icon from './Icon.jsx'
import { ErrorNotice } from './ui.jsx'

// ファイルの中身をこの端末内で解析して本文ブロックに追加する。
// 添付(クラウド保管)と違い、セッションもクラウド保存も要らない。
export default function Extract({ record, onChange, note }) {
  const input = useRef(null), latest = useRef(record), alive = useRef(true)
  latest.current = record
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState('')
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const pick = async e => {
    const files = Array.from(e.target.files || []); e.target.value = ''
    if (!files.length || busy) return
    setBusy(true); setError(''); setDone('')
    const added = [], failed = []
    for (const file of files) {
      try {
        const { title, blocks } = await importFile(file)
        if (files.length > 1) added.push(textBlock(title, 'h2'))
        added.push(...blocks)
      } catch (err) {
        console.error('extract failed:', file.name, err)
        failed.push(file.name)
      }
    }
    if (!alive.current) return
    if (added.length) {
      const r = latest.current
      const kept = (r.blocks || []).filter(b => b.type !== 'text' || b.text.trim())
      onChange({ ...r, blocks: [...kept, ...added] })
    }
    if (failed.length) setError(`読み込めなかったファイル: ${failed.join('、')}`)
    else setDone(`${files.length}件のファイルの内容を本文に追加しました。`)
    setBusy(false)
  }
  return <div className="extract-tool">
    <button className="secondary" disabled={busy} onClick={() => input.current.click()}>
      <Icon name="file" /> {busy ? 'ファイルを読み取っています…' : 'ファイルの内容を本文に取り込む'}
    </button>
    <p className="hint">Word・Excel・PDF・CSVの文字をこの端末内で取り出して{note || '本文'}に追加します。クラウド保存は不要です。</p>
    <input hidden ref={input} type="file" multiple accept={IMPORT_ACCEPT} onChange={pick} />
    {done && <p className="hint extract-done">{done}</p>}
    {error && <ErrorNotice>{error}</ErrorNotice>}
  </div>
}
