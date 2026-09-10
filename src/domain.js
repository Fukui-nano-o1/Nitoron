import { sanitizeAttachments } from './attachment-domain.js'
export const uid = () => crypto.randomUUID()
export const today = () => new Date().toLocaleDateString('sv-SE')
export const textBlock = (text = '', type = 'text') => ({ id: uid(), type, text })
export const META = 'nitoron-presentation-v1'
export const KINDS = { presentation: '経営発表', challenge: '挑戦', learning: '学習ノート', trouble: 'トラブル', memo: 'メモ' }
export const PHASES = ['仮説', '計画中', '実践中', '振り返り', '完了']
export const SECTIONS = [
  ['issue', '課題', '何が起きていて、何を変えたいか'],
  ['hypothesis', '仮説', '何を変えると、なぜ、どうなると考えたか'],
  ['action', '実践したこと', '手順・資材・量・回数など、他の人が試せる具体性で'],
  ['result', '結果', '測定や記録から確認できたこと。失敗や変化なしも残す'],
  ['interpretation', '考察', '結果をどう解釈したか。未確認の原因と区別する'],
  ['learning', '学びと次の一手', '次に変えること・続けること・やめること'],
]
export const METRICS = [
  ['revenue', '売上', '円'], ['cost', '経費', '円'], ['hours', '作業時間', '時間'], ['yieldKg', '収穫量', 'kg'],
]
export const emptyMeta = (kind = 'presentation') => ({
  schema: 1, kind, inputMode: 'free', author: '', club: '', crop: '', variety: '', region: '', areaA: '',
  start: '', end: '', coverUrl: '', summary: '', issue: '', hypothesis: '', action: '', result: '',
  interpretation: '', learning: '', conditions: '', stage: '仮説',
  target: '', deadline: '', criterion: '', revenue: '', cost: '', hours: '', yieldKg: '',
  observations: [], sources: [], attachments: [], origin: null,
})
const string = value => typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
export const hasSectionContent = m => !!(m.summary || m.crop || m.variety || m.region || m.club || m.areaA || m.start || m.end || m.conditions || m.target || m.criterion || m.deadline || SECTIONS.some(([key]) => m[key]) || METRICS.some(([key]) => m[key]) || m.observations.length || m.sources.length)
// 発表者名は作成時に自動で入るため、空判定では見ない。
export const isBlankRecord = r => !String(r.title || '').trim() && !(r.blocks || []).some(b => String(b?.text || '').trim())
  && (!r.meta || !hasSectionContent(r.meta) && !r.meta.attachments?.length && !r.meta.coverUrl && !r.meta.origin)
export function sanitizeMeta(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const m = emptyMeta(['presentation', 'challenge', 'learning', 'trouble'].includes(raw.kind) ? raw.kind : 'presentation')
  for (const key of Object.keys(m)) if (typeof m[key] === 'string' && key !== 'kind') m[key] = string(raw[key])
  m.coverUrl = safeUrl(m.coverUrl) || ''
  m.attachments = sanitizeAttachments(raw.attachments)
  if (!PHASES.includes(m.stage)) m.stage = '仮説'
  m.observations = (Array.isArray(raw.observations) ? raw.observations : []).filter(x => x && typeof x === 'object').map(o => ({ id: string(o.id) || uid(), date: string(o.date), fact: string(o.fact), conditions: string(o.conditions), evidence: string(o.evidence) }))
  m.sources = (Array.isArray(raw.sources) ? raw.sources : []).filter(x => x && typeof x === 'object').map(s => ({ id: string(s.id) || uid(), title: string(s.title), url: string(s.url), date: string(s.date) }))
  m.origin = raw.origin && typeof raw.origin === 'object' && typeof raw.origin.id === 'string' ? { id: raw.origin.id, title: string(raw.origin.title), public: raw.origin.public === true } : null
  // 項目入力で書かれた既存の記録は項目モードで開く。指定がなければフリー入力。
  if (m.inputMode !== 'free' && m.inputMode !== 'sections') m.inputMode = hasSectionContent(m) ? 'sections' : 'free'
  return m
}
export function newRecord(kind = 'presentation', author = '') {
  return { id: uid(), title: '', category: '未分類', type: 'メモ', date: today(),
    blocks: [textBlock()], meta: kind === 'memo' ? null : { ...emptyMeta(kind), author } }
}
export function fromRow(row) {
  const blocks = Array.isArray(row.blocks) ? row.blocks : (typeof row.body === 'string' ? row.body.split('\n').map(x => textBlock(x)) : [])
  const stored = blocks.find(b => b?.type === META)?.data || row.meta
  const cleanBlocks = blocks.filter(b => b && typeof b === 'object' && b.type !== META).map(b => ({ ...b, id: string(b.id) || uid(), text: string(b.text) }))
  return { id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id || '') ? row.id : uid(), title: string(row.title), category: string(row.category || row.crop) || '未分類',
    type: ['メモ', 'アイデア', 'タスク'].includes(row.type) ? row.type : 'メモ', date: (string(row.date) || today()).slice(0, 10),
    blocks: cleanBlocks.length ? cleanBlocks : [textBlock()],
    meta: sanitizeMeta(stored) }
}
export function toRow(record, userId) {
  return { id: record.id, ...(userId ? { user_id: userId } : {}), title: record.title,
    category: record.meta?.crop || record.category || '未分類', type: record.type || 'メモ', date: record.date,
    blocks: [...(record.blocks || []).filter(b => b.type !== META), ...(record.meta ? [{ id: `${record.id}-meta`, type: META, data: record.meta }] : [])] }
}
export function snapshot(record) {
  // Whitelist document fields: no user IDs, auth state, pending writes or private workspace data.
  return { id: record.id, title: record.title, category: record.category, type: record.type, date: record.date,
    meta: record.meta ? structuredClone(record.meta) : null, blocks: structuredClone(record.blocks || []) }
}
export const recordText = r => [r.title, r.category, r.type, ...(r.blocks || []).map(b => b.text),
  r.meta ? JSON.stringify(r.meta) : ''].join(' ')
export const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
export function matches(record, query) {
  const haystack = normalize(recordText(record))
  return normalize(query).split(/\s+/).filter(Boolean).every(term => haystack.includes(term))
}
export function number(value) {
  if (value == null || typeof value === 'boolean' || typeof value === 'string' && value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}
export function per10a(value, area) {
  const n = number(value), a = number(area)
  const result = n !== null && a !== null && a > 0 ? n / a * 10 : null
  return result !== null && Number.isFinite(result) ? result : null
}
export const formatNumber = value => value === null ? '未記録' : new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 }).format(value)
export function publicationProblems(record) {
  if (!record.meta) return ['メモを経営発表に変換してください。']
  const issues = String(record.title || '').trim() ? [] : ['タイトルを入力してください。']
  if (record.meta.start && record.meta.end && record.meta.start > record.meta.end) issues.push('期間の終了日が開始日より前です。')
  for (const [key, label] of METRICS) if (record.meta[key] !== '' && number(record.meta[key]) === null) issues.push(`${label}は0以上の数値で入力してください。`)
  if (record.meta.areaA !== '' && !(number(record.meta.areaA) > 0)) issues.push('面積は0より大きい数値で入力してください。')
  return issues
}
export function deriveRecord(source, kind, author = '') {
  const record = newRecord(kind, author)
  record.title = `${source.title || '無題'}からの${kind === 'challenge' ? '挑戦' : '学び'}`
  record.meta.crop = source.meta?.crop || ''
  record.meta.origin = { id: source.id, title: source.title, public: !!source.publication }
  return record
}
export function mergeRecords(remote, local, pending) {
  const map = new Map(remote.map(r => [r.id, r]))
  for (const record of local) if (pending[record.id]) map.set(record.id, record)
  return [...map.values()]
}
export function exportMarkdown(r) {
  const m = r.meta
  const lines = [`# ${r.title || '無題'}`, '', `記録日: ${r.date}`]
  if (m) {
    lines.push(`発表者: ${m.author || '未記録'} / 所属: ${m.club || '未記録'}`, `作物: ${m.crop || '未記録'} / 品種: ${m.variety || '未記録'} / 地域: ${m.region || '未記録'}`,
      `対象期間: ${m.start || '未記録'}〜${m.end || '未記録'} / 面積: ${m.areaA || '未記録'} a`, '', m.summary)
    for (const [key, label] of SECTIONS) if (m[key]) lines.push('', `## ${label}`, '', m[key])
    if (m.observations.length) { lines.push('', '## 観測した事実'); for (const o of m.observations) lines.push('', `- ${o.date || '日付未記録'}: ${o.fact}`, `  条件: ${o.conditions || '未記録'} / 根拠: ${o.evidence || '未記録'}`) }
    lines.push('', '## 経営の数字', '', ...METRICS.map(([key, label, unit]) => `- ${label}: ${formatNumber(number(m[key]))}${number(m[key]) === null ? '' : unit}`))
    if (m.conditions) lines.push('', `比較時の条件: ${m.conditions}`)
    if (m.kind === 'challenge') lines.push('', '## 挑戦の計画', `進捗: ${m.stage}`, `目標: ${m.target}`, `判定基準: ${m.criterion}`, `期限: ${m.deadline}`)
    if (m.origin) lines.push('', `参考にした発表: ${m.origin.title} (${m.origin.id})`)
    if (m.sources.length) lines.push('', '## 出典・資料', '', ...m.sources.map(s => `- ${s.title || '資料'}: ${s.url || ''} (${s.date || '日付未記録'})`))
    if (m.attachments?.length) lines.push('', '## 添付資料', '', ...m.attachments.map(a => `- ${a.name}${a.caption ? ` — ${a.caption}` : ''}`), '', '添付ファイル本体はこのMarkdownに含まれません。Nitoronの記録から開いてください。')
  }
  for (const b of r.blocks || []) lines.push('', `${({ h1: '# ', h2: '## ', h3: '### ', bullet: '- ', quote: '> ', todo: b.checked ? '- [x] ' : '- [ ] ' })[b.type] || ''}${b.text || ''}`)
  return lines.join('\n')
}
export function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null } catch { return null }
}

// 公開の推奨項目。未入力でも下書き保存・公開は止めない（止める条件は publicationProblems）。
export function publicationAdvice(record) {
  const m = record.meta
  if (!m) return []
  const advice = []
  if (m.kind === 'challenge') {
    if (!m.target.trim()) advice.push('目標が未入力です。何をどこまで変えるかを書くと、振り返りやすくなります。')
    if (!m.criterion.trim()) advice.push('判定基準が未入力です。何を測って何と比べるかを書くと、結果を確かめられます。')
  }
  if (!m.crop.trim()) advice.push('作物が未入力です。検索と比較の条件に使われます。')
  if (!m.region.trim()) advice.push('地域が未入力です。地域で探す人に見つけてもらえます。')
  if (m.kind !== 'challenge' && !m.summary.trim()) advice.push('要約が未入力です。読む人が最初に試したことと分かったことをつかめます。')
  if (m.kind !== 'challenge' && !m.observations.some(o => o.fact.trim())) advice.push('観測した事実がありません。日付・条件・根拠つきの事実が1件あると根拠が伝わります。')
  return advice
}
// 公開対象の内容（snapshot）だけをキー順に依存せず比べる。同期情報や配列以外のキー順の違いでは変更扱いにしない。
const stable = value => Array.isArray(value) ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}` : JSON.stringify(value ?? null)
export const publicationKey = record => stable(snapshot(fromRow(snapshot(record))))
export const publishedDiffers = (record, publishedSnapshot) => publicationKey(record) !== publicationKey(fromRow(publishedSnapshot))
