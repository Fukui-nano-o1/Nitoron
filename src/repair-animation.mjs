// Presentation timing only. It never changes a saved machine reference or model.
export const REPAIR_STAGE_MS = 720
export const REPAIR_EXPLODE = .8

export function repairProgress(elapsed, duration) {
  if (!Number.isFinite(elapsed) || !Number.isFinite(duration) || duration <= 0) throw new TypeError('Invalid animation timing')
  const t = Math.max(0, Math.min(1, elapsed / duration))
  return t * t * (3 - 2 * t)
}

// A catalog hierarchy is data. This planner does not assume a manufacturer or
// parts vocabulary; resolving machine/version identity belongs to the caller.
export function repairScopePath(nodes, partId, rootId = 'machine') {
  const index = new Map(nodes.map(node => [node.id, node]))
  let node = index.get(partId)
  if (!node || !index.has(rootId)) return null
  const path = [], seen = new Set()
  while (node) {
    if (seen.has(node.id)) return null
    seen.add(node.id); path.unshift(node.id)
    if (node.id === rootId) return partId === rootId ? path : path.slice(0, -1)
    node = index.get(node.parent)
  }
  return null
}

export function createRepairAnimation({ lease, scopes, targetRef, requestFrame, cancelFrame, now,
  reducedMotion = false, onState = () => {} }) {
  if (!Array.isArray(scopes) || !scopes.length) throw new TypeError('Animation requires a resolved hierarchy')
  let frame = null, stopped = false, index = 0, started = 0, currentScope = scopes[0]
  function active() { return !stopped && lease.active }
  function stop(reason = 'interrupted') {
    if (stopped) return
    stopped = true
    if (frame !== null) cancelFrame(frame)
    frame = null
    if (lease.active) lease.setScope(currentScope, { interrupt: true })
    onState(reason)
  }
  function finish() {
    if (!active()) return stop('released')
    // RAF ordering and background-tab throttling must not leave a half frame.
    if (!lease.setScope(currentScope, targetRef.partId === scopes[0] ? 0 : REPAIR_EXPLODE)) return stop('unavailable')
    if (targetRef.partId !== scopes[0] && !lease.select(targetRef)) return stop('unavailable')
    stopped = true; frame = null; onState('complete')
  }
  function beginStage() {
    if (!active()) return stop('released')
    currentScope = scopes[index]
    if (!lease.setScope(currentScope, { amount: REPAIR_EXPLODE, transitionMs: REPAIR_STAGE_MS })) return stop('unavailable')
    started = now()
    frame = requestFrame(tick)
  }
  function tick(time) {
    frame = null
    if (!active()) return stop('released')
    if (time - started >= REPAIR_STAGE_MS) {
      index += 1
      if (index >= scopes.length) return finish()
      beginStage()
    } else frame = requestFrame(tick)
  }
  if (!lease.active) stop('released')
  else if (reducedMotion) {
    currentScope = scopes.at(-1)
    if (!lease.setScope(currentScope, targetRef.partId === scopes[0] ? 0 : REPAIR_EXPLODE)) stop('unavailable')
    else finish()
  } else if (targetRef.partId === scopes[0]) {
    if (!lease.setScope(scopes[0], 0)) stop('unavailable')
    else finish()
  } else {
    if (!lease.setScope(scopes[0], 0)) stop('unavailable')
    else { onState('playing'); frame = requestFrame(beginStage) }
  }
  return Object.freeze({ stop, get running() { return !stopped } })
}
