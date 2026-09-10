import test from 'node:test'
import assert from 'node:assert/strict'
import { createPress } from '../src/press-domain.js'

test('長押しで発動し、離すとプレビューが終わる', () => {
  const press = createPress()
  press.down(1, 100, 100)
  assert.equal(press.fire(1), true)
  assert.equal(press.up(1), 'end-preview')
})

test('発動前の短いタップは従来どおり詳細へ（clickを抑止しない）', () => {
  const press = createPress()
  press.down(1, 100, 100)
  assert.equal(press.up(1), 'tap')
  assert.equal(press.consumeClick(), false)
})

test('8pxを超える移動はスクロール優先で取り消し、発動しない', () => {
  const press = createPress({ slop: 8 })
  press.down(1, 100, 100)
  assert.equal(press.move(1, 104, 104), 'hold') // 約5.7px：継続
  assert.equal(press.move(1, 110, 106), 'cancel') // 約11.7px：取消
  assert.equal(press.fire(1), false)
  assert.equal(press.up(1), 'ignore')
})

test('発動後の移動はプレビューを終える', () => {
  const press = createPress()
  press.down(1, 100, 100)
  press.fire(1)
  assert.equal(press.move(1, 120, 120), 'cancel-preview')
})

test('発動直後のclickだけ抑止し、次の独立した短押しは有効', () => {
  const press = createPress()
  press.down(1, 100, 100); press.fire(1); press.up(1)
  assert.equal(press.consumeClick(), true)  // 長押し直後のclickは1回だけ抑止
  assert.equal(press.consumeClick(), false)
  press.down(2, 100, 100)
  assert.equal(press.up(2), 'tap')
  assert.equal(press.consumeClick(), false)
})

test('clickが来ないまま次の押下が始まれば抑止を持ち越さない', () => {
  const press = createPress()
  press.down(1, 100, 100); press.fire(1); press.up(1)
  press.down(2, 100, 100) // consumeClickされないままの新しい操作
  assert.equal(press.up(2), 'tap')
  assert.equal(press.consumeClick(), false)
})

test('別ポインタと pointercancel を安全に扱う', () => {
  const press = createPress()
  press.down(1, 100, 100)
  assert.equal(press.move(2, 300, 300), 'ignore')
  assert.equal(press.up(2), 'ignore')
  press.fire(1)
  assert.equal(press.cancel(), 'end-preview')
  assert.equal(press.cancel(), 'none')
})
