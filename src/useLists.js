import { useEffect, useRef, useState } from 'react'
import { listLists, listListItems, createList, renameList, deleteList, setListSharing, addToList, removeFromList } from './community.js'
// 名前付き保存リストと所属。所属は本人の bookmark に従属するため、bookmark の集合（bookmarkIds）で常に絞って返す。
export default function useLists(session, bookmarkIds, notify) {
  const owner = session?.user.id
  const [state, setState] = useState({ owner: null, lists: [], items: [], ready: false, error: '' }), [version, setVersion] = useState(0)
  const currentOwner = useRef(owner)
  currentOwner.current = owner
  useEffect(() => {
    let active = true
    if (!owner) { setState({ owner, lists: [], items: [], ready: true, error: '' }); return }
    setState({ owner, lists: [], items: [], ready: false, error: '' })
    Promise.all([listLists(owner), listListItems(owner)]).then(([lists, items]) => { if (active) setState({ owner, lists, items, ready: true, error: '' }) })
      .catch(e => { if (active) setState({ owner, lists: [], items: [], ready: true, error: e.message }) })
    return () => { active = false }
  }, [owner, version])
  const mine = state.owner === owner
  const lists = mine ? state.lists : []
  const items = mine ? state.items.filter(i => bookmarkIds.includes(i.publication_id)) : []
  const guard = () => { if (!owner) throw new Error('ログインしてから保存リストを使ってください。'); if (state.error) throw new Error(state.error); if (!state.ready) throw new Error('保存リストを読み込み中です。') }
  const patch = fn => { if (currentOwner.current === owner) setState(s => ({ ...s, ...fn(s) })) }
  const run = async fn => { try { guard(); return await fn() } catch (e) { notify(e.message); return null } }
  return {
    lists, items, ready: mine && state.ready, error: mine ? state.error : '',
    listsOf: publicationId => items.filter(i => i.publication_id === publicationId).map(i => i.list_id),
    countOf: listId => items.filter(i => i.list_id === listId).length,
    create: name => run(async () => { const list = await createList(owner, name); patch(s => ({ lists: [...s.lists, list] })); return list }),
    rename: (id, name) => run(async () => { const list = await renameList(id, name); patch(s => ({ lists: s.lists.map(l => l.id === id ? list : l) })); return list }),
    remove: id => run(async () => { await deleteList(id); patch(s => ({ lists: s.lists.filter(l => l.id !== id), items: s.items.filter(i => i.list_id !== id) })); return true }),
    setSharing: (id, shared) => run(async () => { const list = await setListSharing(id, shared); patch(s => ({ lists: s.lists.map(l => l.id === id ? list : l) })); return list }),
    add: (listId, publicationId) => run(async () => { await addToList(listId, publicationId); patch(s => ({ items: s.items.some(i => i.list_id === listId && i.publication_id === publicationId) ? s.items : [{ list_id: listId, publication_id: publicationId, added_at: new Date().toISOString() }, ...s.items] })); return true }),
    removeItem: (listId, publicationId) => run(async () => { await removeFromList(listId, publicationId); patch(s => ({ items: s.items.filter(i => !(i.list_id === listId && i.publication_id === publicationId)) })); return true }),
    retry: () => setVersion(v => v + 1),
  }
}
