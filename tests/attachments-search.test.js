import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeAttachments, validateFile, FILE_LIMIT } from '../src/attachment-domain.js'
import { newRecord, toRow, fromRow, deriveRecord } from '../src/domain.js'
import { filterRecord, EMPTY_FILTERS } from '../src/search.js'
const file = { path: '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf', name: '発表.pdf', type: 'application/pdf', size: 1024, caption: '実測値' }
test('添付は往復保存でき、署名URLや任意のプロパティは保存しない', () => {
  const r = newRecord(); r.meta.attachments = [{ ...file, signedUrl: 'https://secret.example', user_id: 'spoof' }]
  assert.deepEqual(fromRow(toRow(r)).meta.attachments, [file])
  assert.deepEqual(deriveRecord(r, 'challenge').meta.attachments, [])
})
test('HTML・SVG・別の拡張子・重複・巨大ファイル・不正パスを拒否', () => {
  for (const type of ['text/html', 'image/svg+xml', '']) assert.throws(() => validateFile({ type, size: 100 }))
  assert.throws(() => validateFile({ type: 'application/pdf', size: FILE_LIMIT + 1 }))
  assert.throws(() => validateFile({ type: 'application/pdf', size: 0 }))
  assert.throws(() => validateFile({ type: 'application/pdf', size: 100 }, 12))
  assert.deepEqual(sanitizeAttachments([file, file, { ...file, path: '../secret.pdf' }, { ...file, type: 'image/png' }]), [file])
})
test('検索は全単語・かな・全角・地域・種類・日付を組み合わせる', () => {
  const r = newRecord('challenge');r.title = '育苗の改善';r.date = '2026-09-08'
  Object.assign(r.meta, { crop: 'ブロッコリー', region: 'トクシマ県Ａ地区', hypothesis: '水分を保持する', stage: '実践中', hours: '0' })
  assert.equal(filterRecord(r, { query: 'ぶろっこりー 水分', region: 'とくしま県a', filters: { ...EMPTY_FILTERS, crop: 'ﾌﾞﾛｯｺﾘｰ', stage: '実践中', from: '2026-09-01', to: '2026-09-08', numbers: true } }), true)
  assert.equal(filterRecord(r, { filters: { ...EMPTY_FILTERS, to: '2026-09-07' } }), false)
  assert.equal(filterRecord(r, { query: 'ブロッコリー 不在の単語' }), false)
  r.meta.hours = ''
  assert.equal(filterRecord(r, { filters: { ...EMPTY_FILTERS, numbers: true } }), false)
})
