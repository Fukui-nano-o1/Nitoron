import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { RepairHome, RepairDetail } from './repo/src/RepairWorkspace.jsx'
import { REPAIR_MACHINES, newRepairRecord } from './repo/src/repair-workspace.mjs'
import './repo/src/styles.css'
import './repo/src/design.css'
import './repo/src/repair-workspace.css'

const KEY = 'nitoron:repair-ux-preview:v1'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
function Preview() {
  const [records, setRecords] = useState(read), [route, setRoute] = useState(location.hash), [error, setError] = useState('')
  useEffect(() => { const move = () => { setRoute(location.hash); window.scrollTo(0, 0) }; window.addEventListener('hashchange', move); return () => window.removeEventListener('hashchange', move) }, [])
  const store = record => {
    const next = [record, ...records.filter(r => r.id !== record.id)]
    setRecords(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)); setError(''); return record } catch { setError('この端末に保存できません。'); return null }
  }
  const id = route.match(/^#\/repair\/([^/]+)/)?.[1], record = records.find(r => r.id === id)
  const sample = () => {
    const r = newRepairRecord(REPAIR_MACHINES[0]); r.id = '11111111-2222-4333-8444-555555555555'; r.meta.machineRef.partId = 'aircleaner'
    r.meta.issue = 'エンジンの出力が低下する'
    if (store(records.find(item => item.id === r.id) || r)) location.hash = `/repair/${r.id}`
  }
  return <><header className="preview-header"><a href="#/repairs">nitoron</a><span>操作プレビュー</span><button onClick={sample}>部品から試す</button></header>
    <main>{record ? <RepairDetail key={record.id} record={record} onSave={store} save={{ status: error ? '未保存' : 'この端末に保存', error, retry: () => store(record) }} /> : <RepairHome records={records} ready save={{ error }} onCreate={r => { const saved = store(r); if (saved) location.hash = `/repair/${r.id}`; return saved }} />}</main>
    <nav className="preview-bottom"><a href="#/repairs">機械を探す</a><a href="#/repairs">修理の記録</a></nav>
  </>
}
createRoot(document.getElementById('root')).render(<Preview />)
