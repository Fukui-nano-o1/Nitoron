import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
// カタログ解説データの構造規則：数値には頁、手順語なし、出典の必須項目。
const root = new URL('../data/catalog/', import.meta.url).pathname
const procedure = /(外して|取り外し|緩め|ゆるめ|締め付け|締付け|注入し|抜き|洗い|浸し|絞)/
async function entries() {
  const list = []
  for (const maker of await readdir(root)) for (const file of await readdir(join(root, maker))) if (file.endsWith('.json') && !file.endsWith('.check.json')) list.push([`${maker}/${file}`, JSON.parse(await readFile(join(root, maker, file), 'utf8'))])
  return list
}
test('every catalogue entry cites its sources and keeps the three rules', async () => {
  const all = await entries(); assert.ok(all.length >= 1)
  for (const [name, e] of all) {
    assert.equal(e.schema, 'nitoron-catalog/1', name)
    assert.deepEqual(e.rules, ['原文と図を転載しない', '数値は必ず頁を添える', '原典にない手順を書かない'], name)
    assert.ok(/^https:\/\/agriculture\.kubota\.co\.jp\//.test(e.sources.product.url) && e.sources.product.checkedAt, name)
    assert.ok(/^[a-f0-9]{64}$/.test(e.sources.manual.sha256) && e.sources.manual.physicalPages > 0 && e.sources.manual.noticeUrl, name)
    assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}\+09:00$/.test(e.timing.start), name)
    for (const el of e.elements) {
      assert.ok(el.summary && !procedure.test(el.summary), `${name} ${el.id} summary`)
      for (const it of el.items) {
        assert.ok(it.label && it.value, `${name} ${el.id} item`)
        const hasNumber = /\d/.test(it.value.normalize('NFKC'))
        if (it.source === 'product') assert.ok(e.sources.product.url, name)
        else { assert.ok(it.printed !== undefined, `${name} ${el.id} ${it.label}: page missing`); if (typeof it.printed === 'number') assert.ok(it.printed >= 1 && it.printed + 18 <= e.sources.manual.physicalPages, `${name} ${it.label}: page out of range`) }
        assert.ok(!hasNumber || it.printed !== undefined || it.source === 'product', `${name} ${it.label}: number without page`)
        for (const f of ['value', 'note']) if (it[f] && procedure.test(it[f]) && !/手順は|やり方は|方法は/.test(it[f])) assert.fail(`${name} ${el.id} ${it.label}: procedure wording in ${f}`)
      }
    }
    for (const s of e.symptoms) { assert.ok(s.printed, name); for (const c of s.checks) assert.ok(c.point && c.printed, `${name} symptom ${s.symptom}: ${c.point}`) }
  }
})
