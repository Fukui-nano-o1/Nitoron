// The same queue is used for autosave, manual retry and flushing before publication.
export async function drainOutbox(state, { write, isCurrent, onSaved }) {
  while (Object.keys(state.pending).length && isCurrent()) {
    for (const id of Object.keys(state.pending)) {
      if (!isCurrent()) return false
      const revision = state.pending[id], record = state.records.find(r => r.id === id)
      if (!record) { delete state.pending[id]; continue }
      await write(record)
      if (!isCurrent()) return false
      if (state.pending[id] === revision) delete state.pending[id]
      onSaved()
    }
  }
  return isCurrent()
}
