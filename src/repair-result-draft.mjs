// A failed put may already have changed in-memory state. Revisions replace only
// this draft's last candidate; unrelated concurrent changes always stop the save.
export function createResultDraft(meta) {
  const base = structuredClone(meta)
  let attempted = null, attemptInput = null
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const append = (old, value) => value ? (old ? old + '\n\n' : '') + value : old
  return {
    prepare(current, action, result) {
      if (!same(current, base) && !(attempted && same(current, attempted)) && !(attemptInput && same(current, attemptInput))) throw new Error('記録が別の操作で変わりました。入力を控えて開き直してください。')
      const next = { ...structuredClone(base), action: append(base.action || '', action.trim()), result: append(base.result || '', result.trim()), inputMode: 'sections' }
      if (next.action.length > 20000 || next.result.length > 20000) throw new Error('記録が長すぎます。短くしてください。')
      attemptInput = structuredClone(current)
      attempted = structuredClone(next)
      return next
    },
  }
}
