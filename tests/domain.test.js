import test from 'node:test'
import assert from 'node:assert/strict'
import { newRecord, isBlankRecord, toRow, fromRow, snapshot, matches, number, per10a, publicationProblems, publicationAdvice, publicationKey, publishedDiffers, deriveRecord, mergeRecords, exportMarkdown, safeUrl, sanitizeMeta } from '../src/domain.js'

test('既存メモの文章・ブロック・完了状態を引き継ぐ', () => {
  const original = { id: crypto.randomUUID(), title: '既存の記録', type: 'タスク', category: '畑', date: '2026-08-20', blocks: [{ id: 'b', type: 'todo', text: '測定する', checked: true }] }
  assert.deepEqual(toRow(fromRow(original)), original)
  assert.equal(fromRow({ id: 'old', body: '観測1\n観測2' }).blocks.length, 2)
})
test('経営発表は既存notesのJSON内で往復し、公開スナップショットには認証情報を含めない', () => {
  const r = newRecord(); r.meta.crop = 'ブロッコリー'; r.meta.hypothesis = '仮説'; r.session = { access_token: 'private' }; r.user_id = 'private-owner'; r.pending = true
  const restored = fromRow(toRow(r, 'owner'))
  assert.equal(restored.meta.hypothesis, '仮説')
  assert.equal(restored.meta.crop, 'ブロッコリー')
  const publicVersion = snapshot(r)
  assert.equal(publicVersion.session, undefined); assert.equal(publicVersion.user_id, undefined); assert.equal(publicVersion.pending, undefined)
  r.meta.hypothesis = '編集後の仮説'; assert.equal(publicVersion.meta.hypothesis, '仮説')
})
test('全文検索は本文・観測・出典・条件を対象に全角半角とかなを正規化する', () => {
  const r = newRecord(); r.title = 'ＢＲＯＣＣＯＬＩ'; r.meta.observations = [{ fact: 'ブロッコリーの苗が活着した', evidence: '計測Ａ１２' }]; r.meta.sources = [{ title: '徳島県の資料' }]
  assert.equal(matches(r, 'broccoli ぶろっこりー a12 徳島'), true)
  assert.equal(matches(r, 'broccoli 未登場語'), false)
  assert.equal(matches(r, 'ﾌﾞﾛｯｺﾘｰ'), true)
})
test('未入力を0扱いせず、面積不明・0のときは10a換算しない', () => {
  assert.equal(number(''), null); assert.equal(number('  '), null); assert.equal(number(null), null); assert.equal(number('0'), 0)
  assert.equal(number('-1'), null); assert.equal(number('Infinity'), null)
  assert.equal(per10a('200000', '20'), 100000); assert.equal(per10a('0', '20'), 0)
  for (const area of ['', '0', '-10']) assert.equal(per10a('200000', area), null)
  assert.equal(per10a('', '20'), null)
})
test('公開はタイトルだけを必須とし、期間・面積・負数を検査する', () => {
  const r = newRecord(); assert.deepEqual(publicationProblems(r), ['タイトルを入力してください。'])
  r.title = '収穫率を測る'
  assert.deepEqual(publicationProblems(r), [])
  Object.assign(r.meta, { author: '発表者', crop: 'ブロッコリー', summary: '検証計画', areaA: '10' })
  assert.deepEqual(publicationProblems(r), [])
  r.meta.end = '2026-08-01'; r.meta.start = '2026-09-01'; r.meta.cost = '-1'
  assert.equal(publicationProblems(r).length, 2)
})
test('他の発表からの挑戦は元の実績を自分の実績にせず、出典を保持する', () => {
  const source = newRecord(); source.title = '先行事例'; source.meta.revenue = '100000'; source.publication = { id: source.id }
  const next = deriveRecord(source, 'challenge', '自分')
  assert.notEqual(next.id, source.id); assert.equal(next.meta.author, '自分'); assert.equal(next.meta.revenue, '')
  assert.equal(next.meta.origin.id, source.id); assert.equal(next.meta.origin.public, true)
})
test('「この実践を試す」の派生は元の発表を変更せず、作物と参照元だけを引き継ぐ', () => {
  const source = newRecord(); source.title = '排水対策'; source.blocks = [{ id: 'b1', type: 'text', text: '本文' }]
  Object.assign(source.meta, { crop: 'ブロッコリー', region: '徳島', hours: '12', observations: [{ id: 'o1', date: '2026-08-01', fact: '発芽率92%', conditions: '', evidence: '' }] })
  source.publication = { id: source.id, owner: 'owner-1', isPublic: true }
  const before = JSON.stringify(source)
  const next = deriveRecord(source, 'challenge', '自分')
  assert.equal(JSON.stringify(source), before)
  assert.equal(next.meta.kind, 'challenge'); assert.equal(next.meta.crop, 'ブロッコリー')
  assert.deepEqual(next.meta.origin, { id: source.id, title: '排水対策', public: true })
  assert.equal(next.meta.region, ''); assert.equal(next.meta.hours, ''); assert.deepEqual(next.meta.observations, [])
  assert.equal(next.publication, undefined)
})
test('クラウドの新しい記録を読みながら、未送信の編集を保護する', () => {
  const remote = [{ id: 'a', title: 'cloud' }, { id: 'b', title: 'cloud-only' }]
  const local = [{ id: 'a', title: 'unsaved' }, { id: 'c', title: 'offline-new' }, { id: 'deleted', title: 'stale' }]
  const result = mergeRecords(remote, local, { a: 'v2', c: 'v1' })
  assert.equal(result.find(x => x.id === 'a').title, 'unsaved'); assert.ok(result.find(x => x.id === 'b')); assert.ok(result.find(x => x.id === 'c')); assert.equal(result.find(x => x.id === 'deleted'), undefined)
})
test('出典リンクのスクリプト実行と不正なメタデータを受け付けない', () => {
  assert.equal(safeUrl('javascript:alert(1)'), null); assert.equal(safeUrl('data:text/html,test'), null)
  assert.equal(safeUrl('https://example.com/'), 'https://example.com/')
  const m = sanitizeMeta({ author: { injected: true }, kind: 'unknown', sources: 'bad', observations: [null, { fact: '観測' }] })
  assert.equal(m.author, ''); assert.equal(m.kind, 'presentation'); assert.deepEqual(m.sources, []); assert.equal(m.observations.length, 1)
  assert.equal(sanitizeMeta({ kind: 'trouble' }).kind, 'trouble')
  assert.equal(m.inputMode, 'sections')
  assert.equal(sanitizeMeta({}).inputMode, 'free')
  assert.equal(sanitizeMeta({ inputMode: 'free', summary: '項目入力より前の要約' }).inputMode, 'free')
  assert.equal(sanitizeMeta({ summary: '項目入力で書いた要約' }).inputMode, 'sections')
})
test('書き出しでも観測・仮説・考察・出典を区別する', () => {
  const r = newRecord(); Object.assign(r.meta, { hypothesis: '原因の候補', interpretation: '結果の解釈', observations: [{ date: '2026-09-07', fact: '確認した事実', evidence: '原記録' }], sources: [{ title: '原典', url: 'https://example.com', date: '2026-01-01' }] })
  const md = exportMarkdown(r)
  for (const term of ['## 仮説', '## 考察', '## 観測した事実', '原記録', '## 出典・資料', '2026-01-01']) assert.ok(md.includes(term))
})
test('空の記録の判定は自動入力の発表者名を無視し、入力があれば空扱いしない', () => {
  const blank = newRecord('presentation', 'たきと')
  assert.equal(isBlankRecord(blank), true)
  const memo = newRecord('memo'); assert.equal(isBlankRecord(memo), true)
  const titled = newRecord(); titled.title = ' ブロッコリー '; assert.equal(isBlankRecord(titled), false)
  const typed = newRecord(); typed.blocks[0].text = '観測メモ'; assert.equal(isBlankRecord(typed), false)
  const withNumbers = newRecord(); withNumbers.meta.revenue = '1000'; assert.equal(isBlankRecord(withNumbers), false)
  const withPhoto = newRecord(); withPhoto.meta.coverUrl = 'https://example.com/a.jpg'; assert.equal(isBlankRecord(withPhoto), false)
  const derived = deriveRecord({ id: 'src', title: '先行事例', meta: null }, 'challenge'); assert.equal(isBlankRecord(derived), false)
})

test('推奨項目は発表と挑戦で異なり、公開を止める問題とは別に返す', () => {
  const r = newRecord(); r.title = 'タイトルだけ'
  assert.deepEqual(publicationProblems(r), [])
  const advice = publicationAdvice(r)
  assert.ok(advice.some(a => a.includes('作物')) && advice.some(a => a.includes('地域')) && advice.some(a => a.includes('要約')) && advice.some(a => a.includes('観測')))
  assert.ok(!advice.some(a => a.includes('目標')))
  const c = newRecord('challenge'); c.title = '挑戦'
  const ca = publicationAdvice(c)
  assert.ok(ca.some(a => a.includes('目標')) && ca.some(a => a.includes('判定基準')) && !ca.some(a => a.includes('要約')))
  Object.assign(c.meta, { target: '収量1割増', criterion: '株重を10株測る', crop: '水稲', region: '新潟' })
  assert.deepEqual(publicationAdvice(c), [])
  assert.deepEqual(publicationAdvice({ id: 'x', title: 'メモ', blocks: [], meta: null }), [])
})
test('分類・入力モードを切り替えても入力済みの内容は残り、戻せば復元される', () => {
  const r = newRecord('challenge'); Object.assign(r.meta, { target: '目標A', criterion: '基準B', summary: '要約C', issue: '課題D', revenue: '100' })
  r.blocks = [{ id: 'b1', type: 'text', text: '本文E' }]
  const asPresentation = { ...r, meta: { ...r.meta, kind: 'presentation', inputMode: 'free' } }
  const back = fromRow(toRow({ ...asPresentation, meta: { ...asPresentation.meta, kind: 'challenge', inputMode: 'sections' } }))
  assert.equal(back.meta.target, '目標A'); assert.equal(back.meta.criterion, '基準B'); assert.equal(back.meta.summary, '要約C'); assert.equal(back.meta.issue, '課題D'); assert.equal(back.meta.revenue, '100')
  assert.equal(back.blocks[0].text, '本文E')
})
test('公開版との比較は公開対象の内容だけを見て、キー順や同期情報の違いでは変更扱いにしない', () => {
  const r = newRecord(); r.title = '発表'; Object.assign(r.meta, { crop: 'トマト', observations: [{ id: 'o1', date: '2026-08-01', fact: '事実', conditions: '', evidence: '' }] })
  const published = snapshot(r)
  // キー順を入れ替え、同期情報を付けた公開版
  const reordered = JSON.parse(JSON.stringify({ meta: { ...published.meta, observations: [{ evidence: '', conditions: '', fact: '事実', date: '2026-08-01', id: 'o1' }] }, blocks: published.blocks, title: published.title, id: published.id, date: published.date, category: published.category, type: published.type }))
  assert.equal(publishedDiffers({ ...r, pending: true, user_id: 'x' }, reordered), false)
  assert.equal(publicationKey(r), publicationKey(fromRow(published)))
  const edited = { ...r, title: '発表（改）' }
  assert.equal(publishedDiffers(edited, published), true)
  const editedMeta = { ...r, meta: { ...r.meta, crop: 'ナス' } }
  assert.equal(publishedDiffers(editedMeta, published), true)
})
