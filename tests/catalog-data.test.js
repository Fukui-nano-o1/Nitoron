import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { validateOverview, catalogId } from '../scripts/catalog-overview.mjs'
// カタログ解説データの構造規則：数値には頁、手順語なし、出典の必須項目。
const root = new URL('../data/catalog/', import.meta.url).pathname
const procedure = /(外して|取り外し|緩め|ゆるめ|締め付け|締付け|注入し|抜き|洗い|浸し|絞)/
async function entries() {
  const list = []
  for (const maker of await readdir(root)) for (const file of await readdir(join(root, maker))) if (file.endsWith('.json') && !file.endsWith('.check.json') && !file.endsWith('.record.json')) list.push([`${maker}/${file}`, JSON.parse(await readFile(join(root, maker, file), 'utf8'))])
  return list
}
test('every catalogue entry cites its sources and keeps the three rules', async () => {
  const all = await entries(); assert.ok(all.length >= 1)
  const photos = JSON.parse(await readFile(new URL('../data/card-photos.json', import.meta.url), 'utf8')).entries
  for (const [name, e] of all) {
    if (e.schema === 'nitoron-catalog/2') {
      validateOverview(e, photos.find(p => p.id === catalogId(e.maker, e.series)))
      continue
    }
    assert.equal(e.schema, 'nitoron-catalog/1', name)
    assert.deepEqual(e.rules, ['原文と図を転載しない', '数値は必ず頁を添える', '原典にない手順を書かない'], name)
    assert.ok(/^https:\/\/agriculture\.kubota\.co\.jp\//.test(e.sources.product.url) && e.sources.product.checkedAt, name)
    assert.ok(/^[a-f0-9]{64}$/.test(e.sources.manual.sha256) && e.sources.manual.physicalPages > 0 && e.sources.manual.noticeUrl, name)
    assert.ok(Number.isInteger(e.sources.manual.bodyOffset) && e.sources.manual.bodyOffset >= 0, `${name}: bodyOffset`)
    assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}\+09:00$/.test(e.timing.start), name)
    for (const el of e.elements) {
      assert.ok(el.summary && !procedure.test(el.summary), `${name} ${el.id} summary`)
      for (const it of el.items) {
        assert.ok(it.label && it.value, `${name} ${el.id} item`)
        const hasNumber = /\d/.test(it.value.normalize('NFKC'))
        if (it.source === 'product') assert.ok(e.sources.product.url, name)
        else { assert.ok(it.printed !== undefined, `${name} ${el.id} ${it.label}: page missing`); if (typeof it.printed === 'number') assert.ok(it.printed >= 1 && it.printed + e.sources.manual.bodyOffset <= e.sources.manual.physicalPages, `${name} ${it.label}: page out of range`) }
        assert.ok(!hasNumber || it.printed !== undefined || it.source === 'product', `${name} ${it.label}: number without page`)
        for (const f of ['value', 'note']) if (it[f] && procedure.test(it[f]) && !/手順は|やり方は|方法は/.test(it[f])) assert.fail(`${name} ${el.id} ${it.label}: procedure wording in ${f}`)
      }
    }
    for (const s of e.symptoms) { assert.ok(s.printed, name); for (const c of s.checks) assert.ok(c.point && c.printed, `${name} symptom ${s.symptom}: ${c.point}`) }
  }
})

// 原典（取扱説明書・カタログの PDF）をサイトで配信しない（守る規則1、2026-09-15 創業者決定）。配信対象のフォルダに PDF があれば失敗する。
test('サイトが配信するフォルダに取扱説明書・カタログの PDF を置かない', async () => {
  const fs = await import('node:fs'), path = await import('node:path')
  const root = new URL('..', import.meta.url).pathname
  const walk = p => !fs.existsSync(p) ? [] : fs.statSync(p).isDirectory() ? fs.readdirSync(p, { withFileTypes: true }).flatMap(d => walk(path.join(p, d.name))) : [p]
  const served = ['public', 'src', 'data', 'index.html'].flatMap(d => walk(path.join(root, d)))
  const pdfs = served.filter(f => /\.pdf$/i.test(f) || (fs.statSync(f).size > 4 && fs.readFileSync(f).subarray(0, 5).toString('latin1') === '%PDF-'))
  assert.deepEqual(pdfs.map(f => path.relative(root, f)), [])
  // カタログ JSON・記録 JSON に PDF や画像を埋め込まない
  for (const f of served.filter(f => f.startsWith(path.join(root, 'data')) && f.endsWith('.json'))) assert.equal(/data:(application\/pdf|image\/)/.test(fs.readFileSync(f, 'utf8')), false, f)
})

// 取扱説明書の URL のハッシュは 32 桁（8 桁に切り詰めると 404。第1回・第2回で同じ誤りをした）。
test('取扱説明書の案内ページ・ダウンロードの URL は 32 桁のハッシュを持つ', async () => {
  const fs = await import('node:fs'), path = await import('node:path')
  const dir = new URL('../data/catalog/kubota/', import.meta.url).pathname
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('.record.json'))) {
    const entry = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
    if (entry.schema !== 'nitoron-catalog/1') continue
    const m = entry.sources.manual
    for (const key of ['noticeUrl', 'downloadUrl']) assert.match(m[key], /[?&]hash=[0-9a-f]{32}$/, `${f} ${key}`)
  }
})
