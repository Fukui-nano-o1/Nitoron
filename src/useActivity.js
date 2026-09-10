import { useEffect, useRef, useState } from 'react'
import { listNewActivity, markActivitySeen } from './community.js'
// 自分の公開発表と保存した発表に届いた新着（指摘・返信）の件数と、最初の未読の要約。
// 既読は「対話欄に表示した投稿の最新時刻」まで。返信の有無とは切り離し、表示後に届いた投稿は既読にしない。
export default function useActivity(session, items) {
  const owner = session?.user.id
  const [state, setState] = useState({ counts: {}, first: {} })
  const seen = useRef(new Set())
  const key = items.map(i => `${i.id}:${i.since}`).join(',')
  useEffect(() => { seen.current = new Set() }, [owner])
  useEffect(() => {
    let cancelled = false
    setState({ counts: {}, first: {} })
    if (!owner || !items.length) return
    listNewActivity(owner, items).then(result => {
      if (cancelled) return
      for (const id of seen.current) { delete result.counts[id]; delete result.first[id] }
      setState(result)
    }).catch(() => { /* Badges are decorative; each page reports its own errors. */ })
    return () => { cancelled = true }
  }, [owner, key])
  const markSeen = (id, until) => {
    if (!owner || !until || !items.some(i => i.id === id) || seen.current.has(id)) return
    seen.current.add(id)
    setState(s => { const counts = { ...s.counts }, first = { ...s.first }; delete counts[id]; delete first[id]; return { counts, first } })
    markActivitySeen(owner, id, until).then(() => seen.current.delete(id)).catch(() => { /* Kept suppressed locally; retried on the next visit. */ })
  }
  const total = Object.values(state.counts).reduce((sum, n) => sum + n, 0)
  return { counts: state.counts, first: state.first, total, markSeen }
}
