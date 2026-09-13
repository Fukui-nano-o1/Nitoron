import { prepareRepairTransfer } from './repair-pilot.mjs'

// Metadata consists of structured record data. Key order is not a record change;
// missing keys, array order and values are. Never ignore unrelated edited fields.
function sameData(a, b) {
  if (Object.is(a, b)) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false
  const keys = Object.keys(a), other = Object.keys(b)
  return keys.length === other.length && keys.every(key => Object.hasOwn(b, key) && sameData(a[key], b[key]))
}

// A failed put() may already have published its candidate to React state. Retries
// must replace our unconfirmed attempt, not append it again or adopt its target as
// a new baseline. Keep both the submitted output and its accepted input because
// a subsequent failed save may throw before publishing another state update.
export function createRepairTransferSession(meta) {
  const base = structuredClone(meta)
  let lastCandidate = null, attemptInput = null
  return Object.freeze({
    initial: structuredClone(base),
    prepare(current, draft, options) {
      if (!sameData(current, base) && !(lastCandidate && sameData(current, lastCandidate)) && !(attemptInput && sameData(current, attemptInput))) {
        throw new Error('記録が別の場所で変更されました。入力案を控え、閉じてから開き直してください。')
      }
      const next = prepareRepairTransfer(structuredClone(base), draft, { ...options, expectedRef: base.machineRef })
      attemptInput = structuredClone(current)
      lastCandidate = structuredClone(next)
      return next
    }
  })
}
