import test from 'node:test'
import assert from 'node:assert/strict'
import { createRepairAnimation, repairScopePath, repairProgress, REPAIR_STAGE_MS, REPAIR_EXPLODE } from '../src/repair-animation.mjs'
import { createMachineScene } from '../src/machine/engine/scene.js'
import { NODES, MACHINE_ID, MODEL_VERSION } from '../src/machine/catalog.js'

const ref = partId => ({ machineId: MACHINE_ID, modelVersion: MODEL_VERSION, partId })
function scheduler() {
  let clock = 0, sequence = 0
  const frames = new Map(), calls = [], states = []
  const lease = { active: true, setScope: (...args) => { calls.push(['scope', ...args]); return true }, select: value => { calls.push(['select', value]); return true } }
  return { lease, calls, states, frames,
    args: { lease, scopes: ['machine', 'system-0'], targetRef: ref('aircleaner'), requestFrame: callback => { const id = ++sequence; frames.set(id, callback); return id }, cancelFrame: id => frames.delete(id), now: () => clock, onState: state => states.push(state) },
    at(time) { clock = time; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(clock)) },
  }
}
function capture(engine) {
  const values = []
  engine.root.traverse(object => { values.push([object.uuid, object.position.toArray(), object.visible, object.isMesh ? [object.material.opacity, object.material.transparent, object.material.depthWrite] : null]) })
  return { objects: values, camera: engine.camera.position.toArray(), target: engine.target.toArray() }
}

test('hierarchy planning works with SKP and unrelated data, rejects missing parents and cycles', () => {
  assert.deepEqual(repairScopePath(NODES, 'aircleaner__element'), ['machine', 'system-0', 'aircleaner'])
  assert.deepEqual(repairScopePath(NODES, 'machine'), ['machine'])
  const other = [{ id: 'other', parent: null }, { id: 'drive', parent: 'other' }, { id: 'belt', parent: 'drive' }]
  assert.deepEqual(repairScopePath(other, 'belt', 'other'), ['other', 'drive'])
  assert.equal(repairScopePath(other, 'missing', 'other'), null)
  assert.equal(repairScopePath([{ id: 'machine' }, { id: 'a', parent: 'b' }, { id: 'b', parent: 'a' }], 'a'), null)
  assert.equal(repairScopePath([{ id: 'machine' }, { id: 'a', parent: 'gone' }], 'a'), null)
})

test('interpolation clamps time, starts and reaches exact endpoints without overshoot', () => {
  assert.equal(repairProgress(-1, 720), 0)
  assert.equal(repairProgress(0, 720), 0)
  assert.equal(repairProgress(360, 720), .5)
  assert.equal(repairProgress(720, 720), 1)
  assert.equal(repairProgress(1000, 720), 1)
  assert.throws(() => repairProgress(1, 0), TypeError)
})

test('play starts assembled, visits ancestors, settles final scope and highlights only at arrival', () => {
  const fake = scheduler(), animation = createRepairAnimation(fake.args)
  assert.deepEqual(fake.calls, [['scope', 'machine', 0]])
  fake.at(0); fake.at(REPAIR_STAGE_MS / 2)
  assert.equal(fake.calls.some(call => call[0] === 'select'), false)
  fake.at(REPAIR_STAGE_MS); fake.at(REPAIR_STAGE_MS * 2)
  assert.equal(animation.running, false)
  assert.deepEqual(fake.calls.at(-2), ['scope', 'system-0', REPAIR_EXPLODE])
  assert.deepEqual(fake.calls.at(-1), ['select', ref('aircleaner')])
  assert.deepEqual(fake.states, ['playing', 'complete'])
  assert.equal(fake.frames.size, 0)
})

test('user interruption cancels pending work; an expired lease receives no further commands', () => {
  const fake = scheduler(), animation = createRepairAnimation(fake.args)
  fake.at(0); animation.stop('interaction')
  const count = fake.calls.length
  fake.at(10000)
  assert.equal(fake.calls.length, count)
  assert.deepEqual(fake.calls.at(-1), ['scope', 'machine', { interrupt: true }])
  assert.equal(fake.states.at(-1), 'interaction')
  assert.equal(fake.frames.size, 0)
  const expired = scheduler(); createRepairAnimation(expired.args)
  expired.lease.active = false; const before = expired.calls.length; expired.at(0)
  assert.equal(expired.calls.length, before)
  assert.equal(expired.states.at(-1), 'released')
  assert.equal(expired.frames.size, 0)
})

test('reduced motion reaches the saved part immediately, without a timer or whole-machine pulse', () => {
  const fake = scheduler(); createRepairAnimation({ ...fake.args, reducedMotion: true })
  assert.equal(fake.frames.size, 0)
  assert.ok(fake.calls.every(call => call[0] !== 'scope' || typeof call[2] === 'number'))
  assert.deepEqual(fake.calls.at(-1), ['select', ref('aircleaner')])
  const whole = scheduler(); createRepairAnimation({ ...whole.args, scopes: ['machine'], targetRef: ref('machine') })
  assert.equal(whole.frames.size, 0)
  assert.equal(whole.calls.some(call => call[0] === 'select'), false)
})

test('real scene interpolation reaches the same positions, visibility and camera as existing immediate scope', () => {
  const engine = createMachineScene()
  try {
    engine.setScope('system-0', { explode: REPAIR_EXPLODE, now: 0 })
    const expected = capture(engine)
    engine.reset({ now: 0, instant: true }); const before = capture(engine)
    engine.setScope('system-0', { explode: { amount: REPAIR_EXPLODE, transitionMs: 720 }, now: 0 })
    assert.deepEqual(capture(engine), before)
    engine.update(360); const middle = capture(engine)
    assert.notDeepEqual(middle, before); assert.notDeepEqual(middle, expected)
    const nonEngine = []
    engine.root.traverse(object => { if (object.isMesh && object.userData.partId === 'rearL') nonEngine.push(object) })
    assert.ok(nonEngine.length > 0)
    assert.ok(nonEngine.every(mesh => mesh.visible && mesh.material.opacity > 0 && mesh.material.opacity < 1))
    engine.update(720)
    assert.deepEqual(capture(engine), expected)
    assert.equal(engine.state.transitioning, false)
  } finally { engine.dispose() }
})

test('real scene interruption freezes presentation; reset and reduced motion leave no transition behind', () => {
  const engine = createMachineScene()
  try {
    const baseline = capture(engine)
    engine.setScope('aircleaner', { explode: { amount: .8, transitionMs: 720 }, now: 0 })
    engine.update(240); engine.setScope('aircleaner', { explode: { interrupt: true }, now: 240 })
    const interrupted = capture(engine)
    engine.update(5000)
    assert.deepEqual(capture(engine), interrupted)
    assert.equal(engine.state.transitioning, false)
    engine.reset({ now: 5000, instant: true })
    assert.deepEqual(capture(engine), baseline)
    engine.setScope('aircleaner', { explode: { amount: .8, transitionMs: 720 }, now: 5000 })
    engine.setReducedMotion(true)
    assert.equal(engine.state.transitioning, false)
    assert.ok(engine.selectInScope(ref('aircleaner__element'), { now: 5000 }))
    assert.equal(engine.state.selected, 'aircleaner__element')
    engine.root.traverse(mesh => { if (mesh.isMesh && mesh.userData.detailId === 'aircleaner__element') assert.equal(mesh.material.color.getHex(), 0xd31d32) })
  } finally { engine.dispose() }
})
