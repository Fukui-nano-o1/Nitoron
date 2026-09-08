import { useEffect, useRef, useState } from 'react'
import { listFollows, setFollow } from './community.js'
export default function useFollows(session, notify, onAccount) {
  const owner = session?.user.id
  const [state, setState] = useState({ owner: null, ids: [], ready: false, error: '' }), [version, setVersion] = useState(0)
  const pending = useRef(new Set()), currentOwner = useRef(owner)
  currentOwner.current = owner
  useEffect(() => {
    let active = true
    if (!owner) { setState({ owner, ids: [], ready: true, error: '' }); return }
    setState({ owner, ids: [], ready: false, error: '' })
    listFollows(owner).then(ids => { if (active) setState({ owner, ids, ready: true, error: '' }) }).catch(e => { if (active) setState({ owner, ids: [], ready: true, error: e.message }) })
    return () => { active = false }
  }, [owner, version])
  const ids = state.owner === owner ? state.ids : []
  const toggle = async (authorId, authorName = '発表者') => {
    if (!owner) { onAccount(); return }
    if (owner === authorId) { notify('自分の発表はフォローできません。'); return }
    if (state.error) { notify(state.error); return }
    const key = `${owner}:${authorId}`
    if (!state.ready || pending.current.has(key)) return
    pending.current.add(key)
    const following = !ids.includes(authorId)
    try {
      await setFollow(owner, authorId, following)
      if (currentOwner.current === owner) { setState(s => ({ ...s, ids: following ? [...new Set([...s.ids, authorId])] : s.ids.filter(id => id !== authorId) })); notify(following ? `${authorName}をフォローしました。` : `${authorName}のフォローを外しました。`) }
    } catch (e) { if (currentOwner.current === owner) notify(e.message) }
    finally { pending.current.delete(key) }
  }
  return { ids, ready: state.owner === owner && state.ready, error: state.owner === owner ? state.error : '', toggle, retry: () => setVersion(v => v + 1) }
}
