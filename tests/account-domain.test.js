import test from 'node:test'
import assert from 'node:assert/strict'
import { ROLES, PUBLIC_FIELDS, PRIVATE_FIELDS, sanitizePublicProfile, sanitizePrivateProfile, sanitizeMachines, hasMachine, machineLabel, missingPublic, missingPrivate, publicView } from '../src/account-domain.js'

test('公開プロフィールと非公開の連絡先は別の項目集合で、互いに混ざらない', () => {
  const pubKeys = PUBLIC_FIELDS.map(([k]) => k), privKeys = PRIVATE_FIELDS.map(([k]) => k)
  assert.deepEqual(pubKeys.filter(k => privKeys.includes(k)), [])
  const pub = sanitizePublicProfile({ display_name: 'たきと', role: '農家', phone: '090', full_name: '本名', machines: [{ maker: 'クボタ', model: 'SKP-101W' }] })
  assert.equal(pub.display_name, 'たきと'); assert.equal(pub.role, '農家')
  assert.equal('phone' in pub, false); assert.equal('full_name' in pub, false)
  assert.equal(pub.machines.length, 1); assert.match(pub.machines[0].id, /^[0-9a-f-]{36}$/)
  const priv = sanitizePrivateProfile({ phone: '090-0000-0000', display_name: '漏れ', bio: '漏れ' })
  assert.deepEqual(Object.keys(priv), privKeys); assert.equal(priv.phone, '090-0000-0000')
  assert.equal('phone' in publicView({ ...pub, phone: '090' }), false)
})

test('立場は定義済みの選択肢だけ、長さ上限で切り、機械は30台まで', () => {
  assert.equal(sanitizePublicProfile({ role: '宇宙人' }).role, '')
  assert.equal(sanitizePublicProfile({ role: ROLES[1] }).role, ROLES[1])
  assert.equal(sanitizePublicProfile({ bio: 'a'.repeat(700) }).bio.length, 600)
  assert.equal(sanitizePrivateProfile({ address: 'あ'.repeat(300) }).address.length, 200)
  const machines = sanitizeMachines([...Array(35)].map((_, i) => ({ maker: 'M', model: String(i) })))
  assert.equal(machines.length, 30)
  assert.deepEqual(sanitizeMachines('x'), []); assert.deepEqual(sanitizeMachines([null, 'a', { model: 'Z' }]).map(m => m.model), ['Z'])
  assert.equal(hasMachine({ maker: '', model: ' ' }), false); assert.equal(hasMachine({ maker: '', model: 'ZX' }), true)
  assert.equal(machineLabel({ maker: 'クボタ', model: 'SKP-101W' }), 'クボタ SKP-101W'); assert.equal(machineLabel({ maker: '', model: '' }), '機械（未入力）')
})

test('未入力の項目名を列挙する（Airbnb の入力状態パネルに使う）', () => {
  const pub = sanitizePublicProfile({ display_name: 'たきと' })
  assert.deepEqual(missingPublic(pub), ['立場', '活動している地域', '所属', '主な作物', '自己紹介'])
  assert.deepEqual(missingPrivate(sanitizePrivateProfile({ phone: '1' })), ['氏名', '住所'])
})
