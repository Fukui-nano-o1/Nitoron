// 修理記録の内容（meta.repair）。経営発表の項目（作物・面積・経営の数字・課題／仮説／実践…）とは別の入力。
// 構造：機械 → 症状 → 確認したこと（部位・見たこと・根拠）→ 行ったこと（日付・内容・部品・費用・時間）→ 結果。
// 原因・修理完了は自動判定しない。結果は本人の申告として保存する。
const uid = () => crypto.randomUUID()
const string = value => typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

export const REPAIR_OUTCOMES = Object.freeze({
  improved: '症状が改善した', unchanged: '症状は変わらない', 'not-assessed': '再確認していない', consult: '自分では進めず相談する',
})
export const REPAIR_MACHINE_FIELDS = Object.freeze([['maker', 'メーカー'], ['model', '型式'], ['serial', '号機・年式'], ['hours', '稼働時間（h）']])
export const REPAIR_SYMPTOM_FIELDS = Object.freeze([['text', '症状'], ['since', 'いつから'], ['when', '起きる条件']])
export const REPAIR_CHECK_FIELDS = Object.freeze([['part', '部位'], ['finding', '見たこと・測ったこと'], ['basis', '根拠（説明書の頁など）']])
export const REPAIR_ACTION_FIELDS = Object.freeze([['date', '日付'], ['what', '内容'], ['parts', '交換部品・品番'], ['cost', '費用（円）'], ['minutes', '時間（分）']])
const LIMITS = Object.freeze({ short: 200, text: 4000 })

export const emptyRepair = () => ({
  machine: { maker: '', model: '', serial: '', hours: '' },
  symptom: { text: '', since: '', when: '' },
  checks: [], actions: [],
  outcome: { status: '', note: '', recheckOn: '' },
})
const emptyCheck = () => ({ id: uid(), part: '', finding: '', basis: '' })
const emptyAction = () => ({ id: uid(), date: '', what: '', parts: '', cost: '', minutes: '' })
export const newCheck = emptyCheck
export const newAction = emptyAction

const pick = (target, source) => { for (const key of Object.keys(target)) target[key] = string(source?.[key]); return target }
// 欠けた項目は空文字で補い、未知の項目は捨てる。ID のない行には新しい ID を振る。
export function sanitizeRepair(raw) {
  const r = emptyRepair()
  if (!isObject(raw)) return r
  pick(r.machine, raw.machine); pick(r.symptom, raw.symptom); pick(r.outcome, raw.outcome)
  if (!Object.hasOwn(REPAIR_OUTCOMES, r.outcome.status)) r.outcome.status = ''
  r.checks = (Array.isArray(raw.checks) ? raw.checks : []).filter(isObject).map(c => ({ ...pick(emptyCheck(), c), id: string(c.id) || uid() }))
  r.actions = (Array.isArray(raw.actions) ? raw.actions : []).filter(isObject).map(a => ({ ...pick(emptyAction(), a), id: string(a.id) || uid() }))
  return r
}
const rowFilled = (row, keys) => keys.some(key => String(row[key] || '').trim())
export const hasRepairContent = r => !!r && (Object.values(r.machine).some(v => v.trim()) || Object.values(r.symptom).some(v => v.trim())
  || r.checks.some(c => rowFilled(c, ['part', 'finding', 'basis'])) || r.actions.some(a => rowFilled(a, ['what', 'parts', 'cost', 'minutes']))
  || !!r.outcome.status || Object.values(r.outcome).some(v => v.trim()))
export const repairHeadline = r => (r?.symptom?.text || '').split('\n').find(line => line.trim())?.trim() || ''
export const repairMachineLabel = r => [r?.machine?.maker, r?.machine?.model].filter(v => v && v.trim()).join(' ')

const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value
const nonNegative = value => { const n = Number(value); return Number.isFinite(n) && n >= 0 }
// 保存・公開を止める問題。空欄は問題にしない（書きかけのまま保存できる）。
export function repairProblems(raw) {
  const r = sanitizeRepair(raw), issues = []
  const long = (value, limit, label) => { if (value.length > limit) issues.push(`${label}は${limit}文字以内で入力してください。`) }
  for (const [key, label] of REPAIR_MACHINE_FIELDS) long(r.machine[key], LIMITS.short, label)
  if (r.machine.hours !== '' && !nonNegative(r.machine.hours)) issues.push('稼働時間は0以上の数値で入力してください。')
  long(r.symptom.text, LIMITS.text, '症状'); long(r.symptom.since, LIMITS.short, 'いつから'); long(r.symptom.when, LIMITS.text, '起きる条件')
  r.checks.forEach((c, i) => { long(c.part, LIMITS.short, `確認${i + 1}の部位`); long(c.finding, LIMITS.text, `確認${i + 1}の内容`); long(c.basis, LIMITS.short, `確認${i + 1}の根拠`) })
  r.actions.forEach((a, i) => {
    if (a.date !== '' && !validDate(a.date)) issues.push(`対処${i + 1}の日付を確認してください。`)
    long(a.what, LIMITS.text, `対処${i + 1}の内容`); long(a.parts, LIMITS.short, `対処${i + 1}の部品`)
    if (a.cost !== '' && !nonNegative(a.cost)) issues.push(`対処${i + 1}の費用は0以上の数値で入力してください。`)
    if (a.minutes !== '' && !nonNegative(a.minutes)) issues.push(`対処${i + 1}の時間は0以上の数値で入力してください。`)
  })
  if (raw && isObject(raw) && isObject(raw.outcome) && raw.outcome.status && !Object.hasOwn(REPAIR_OUTCOMES, raw.outcome.status)) issues.push('結果の状態を選び直してください。')
  if (['improved', 'unchanged'].includes(r.outcome.status) && !r.actions.some(a => a.what.trim())) issues.push('改善・変化なしは、行ったことを1件以上書いてから選べます。')
  long(r.outcome.note, LIMITS.text, '確認した内容')
  if (r.outcome.recheckOn !== '' && !validDate(r.outcome.recheckOn)) issues.push('次回の確認日を確認してください。')
  return issues
}

// 入力シートの保存案。開いている間に別の操作で記録が変わっていたら保存せず知らせる。
// 保存に失敗した案は、同じシートからの再試行・修正で置き換える（二重追記しない）。
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
export function createRepairEntryDraft(meta) {
  const base = structuredClone(meta)
  let attempted = null, attemptInput = null
  return Object.freeze({
    initial: sanitizeRepair(base.repair),
    prepare(current, repair) {
      if (!same(current, base) && !(attempted && same(current, attempted)) && !(attemptInput && same(current, attemptInput))) throw new Error('記録が別の操作で変わりました。入力を控えて開き直してください。')
      const problems = repairProblems(repair)
      if (problems.length) throw new Error(problems[0])
      const next = { ...structuredClone(base), repair: sanitizeRepair(repair) }
      attemptInput = structuredClone(current); attempted = structuredClone(next)
      return next
    },
  })
}

export function repairMarkdown(r) {
  if (!hasRepairContent(r)) return []
  const lines = ['', '## 修理の内容']
  const row = (label, value) => value && value.trim() ? `- ${label}: ${value}` : null
  const push = rows => { for (const line of rows) if (line) lines.push(line) }
  lines.push('', '### 機械'); push(REPAIR_MACHINE_FIELDS.map(([key, label]) => row(label, r.machine[key])))
  lines.push('', '### 症状'); push(REPAIR_SYMPTOM_FIELDS.map(([key, label]) => row(label, r.symptom[key])))
  if (r.checks.length) { lines.push('', '### 確認したこと'); r.checks.forEach((c, i) => { lines.push(`${i + 1}. ${c.part || '部位未記録'}: ${c.finding || '未記録'}${c.basis ? `（根拠: ${c.basis}）` : ''}`) }) }
  if (r.actions.length) { lines.push('', '### 行ったこと'); r.actions.forEach((a, i) => { lines.push(`${i + 1}. ${a.date || '日付未記録'}: ${a.what || '未記録'}${a.parts ? ` / 部品: ${a.parts}` : ''}${a.cost ? ` / 費用: ${a.cost}円` : ''}${a.minutes ? ` / 時間: ${a.minutes}分` : ''}`) }) }
  lines.push('', '### 結果'); push([row('状態', REPAIR_OUTCOMES[r.outcome.status] || ''), row('確認した内容', r.outcome.note), row('次回の確認', r.outcome.recheckOn)])
  lines.push('', '結果は本人の申告です。原因・修理完了を自動判定した記録ではありません。')
  return lines
}
