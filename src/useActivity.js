import { useEffect, useRef, useState } from 'react'
import { listNewActivity, markActivitySeen } from './community.js'
// New feedback and replies on tracked publications (own public ones and saved
// ones), counted since each item's `since` baseline or the stored seen mark.
export default function useActivity(session, items) {
  const owner = session?.user.id
  const [counts, setCounts] = useState({})
  const seen = useRef(new Set())
  const key = items.map(i => `${i.id}:${i.since}`).join(',')
  useEffect(() => { seen.current = new Set() }, [owner])
  useEffect(() => {
    let cancelled = false
    setCounts({})
    if (!owner || !items.length) return
    listNewActivity(owner, items).then(result => {
      if (cancelled) return
      for (const id of seen.current) delete result[id]
      setCounts(result)
    }).catch(() => { /* Badges are decorative; each page reports its own errors. */ })
    return () => { cancelled = true }
  }, [owner, key])
  const markSeen = id => {
    if (!owner || !items.some(i => i.id === id) || seen.current.has(id)) return
    seen.current.add(id)
    setCounts(c => { const next = { ...c }; delete next[id]; return next })
    markActivitySeen(owner, id).then(() => seen.current.delete(id)).catch(() => { /* Kept suppressed locally; retried on the next visit. */ })
  }
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
  return { counts, total, markSeen }
}
