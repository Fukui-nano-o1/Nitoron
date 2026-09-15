import test from 'node:test'
import assert from 'node:assert/strict'
import { chromeState } from '../src/scroll-chrome.js'

test('ヘッダー・下部ナビは下へ動かすと隠れ、上へ戻すと出る。先頭付近では常に出る', () => {
  let s = { scrolled: false, hidden: false, last: 0 }
  s = chromeState(s, 10); assert.deepEqual([s.scrolled, s.hidden], [false, false])
  s = chromeState(s, 40); assert.deepEqual([s.scrolled, s.hidden], [true, false])       // 先頭から離れた：畳むが隠さない
  s = chromeState(s, 300); assert.deepEqual([s.scrolled, s.hidden], [true, true])      // 下へ：隠す
  s = chromeState(s, 304); assert.equal(s.hidden, true); assert.equal(s.last, 300)      // 震え（delta 以下）は無視
  s = chromeState(s, 280); assert.equal(s.hidden, false)                                // 上へ：出す
  s = chromeState(s, 500); assert.equal(s.hidden, true)
  s = chromeState(s, 50); assert.deepEqual([s.scrolled, s.hidden], [true, false])       // hideAfter 以下：必ず出す
  s = chromeState(s, 0); assert.deepEqual([s.scrolled, s.hidden], [false, false])
  s = chromeState(s, -30); assert.deepEqual([s.scrolled, s.hidden, s.last], [false, false, 0])  // iOS のバウンス
})
