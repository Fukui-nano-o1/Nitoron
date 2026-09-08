import { useEffect, useRef, useState } from 'react'
import { listBookmarks, setBookmark } from './community.js'
export default function useBookmarks(session, notify, onAccount) {
  const owner = session?.user.id
  const [state, setState] = useState({ owner: null, ids: [], ready: false, error: '' }), [version, setVersion] = useState(0)
  const pending = useRef(new Set()), currentOwner = useRef(owner)
  currentOwner.current = owner
  useEffect(() => {
    let active = true
    if (!owner) { setState({ owner, ids: [], ready: true, error: '' }); return }
    setState({ owner, ids: [], ready: false, error: '' })
    listBookmarks(owner).then(ids => { if (active) setState({ owner, ids, ready: true, error: '' }) }).catch(e => { if (active) setState({ owner, ids: [], ready: true, error: e.message }) })
    return () => { active = false }
  }, [owner, version])
  const ids = state.owner === owner ? state.ids : []
  const toggle = async record => {
    if (!owner) { onAccount(); return }
    if (state.error) { notify(state.error); return }
    const key = `${owner}:${record.id}`
    if (!state.ready || pending.current.has(key)) return
    pending.current.add(key)
    const saved = !ids.includes(record.id)
    try {
      await setBookmark(owner, record.id, saved)
      if (currentOwner.current === owner) { setState(s => ({ ...s, ids: saved ? [...new Set([...s.ids, record.id])] : s.ids.filter(id => id !== record.id) })); notify(saved ? '保存リストに追加しました。' : '保存リストから外しました。') }
    } catch (e) { if (currentOwner.current === owner) notify(e.message) }
    finally { pending.current.delete(key) }
  }
  return { ids, ready: state.owner === owner && state.ready, error: state.owner === owner ? state.error : '', toggle, retry: () => setVersion(v => v + 1) }
}
