// アカウントページの項目定義と整形。DB列（nitoron_profiles＝公開／settings＝非公開）と1対1。
const string = value => typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
const uid = () => crypto.randomUUID()

export const ROLES = ['農家', '整備士・修理業', '販売店', 'メーカー', '学生・研修生', 'その他']
// 公開される項目（プロフィール #/user/<id> と発表・修理記録の著者表示に使う）
export const PUBLIC_FIELDS = [
  ['display_name', '表示名', '発表・修理記録・指摘に使う名前', 80],
  ['role', '立場', '農家・整備士・販売店など', 40],
  ['region', '活動している地域', '例：福井県坂井市', 80],
  ['club', '所属', '例：福井4Hクラブ、○○農場', 120],
  ['crops', '主な作物', '例：ブロッコリー、水稲', 200],
  ['bio', '自己紹介', 'つくっている作物、経営の目標、いま検証していること', 600],
]
// 本人だけが読める項目（修理の依頼・見積り・連絡に使う。公開ページ・発表には出ない）
export const PRIVATE_FIELDS = [
  ['full_name', '氏名', '修理の依頼書・見積りに使う本名', 80],
  ['phone', '電話番号', '修理業者・販売店からの連絡用', 40],
  ['address', '住所', '出張修理の目安。市町村まででも可', 200],
]
export const emptyPublicProfile = () => Object.fromEntries(PUBLIC_FIELDS.map(([key]) => [key, '']))
export const emptyPrivateProfile = () => Object.fromEntries(PRIVATE_FIELDS.map(([key]) => [key, '']))
export const emptyMachine = () => ({ id: uid(), maker: '', model: '', year: '', note: '' })

export function sanitizeMachines(raw) {
  return (Array.isArray(raw) ? raw : []).filter(m => m && typeof m === 'object' && !Array.isArray(m))
    .map(m => ({ id: string(m.id) || uid(), maker: string(m.maker).slice(0, 60), model: string(m.model).slice(0, 80), year: string(m.year).slice(0, 12), note: string(m.note).slice(0, 200) }))
    .slice(0, 30)
}
export const hasMachine = m => !!(m.maker.trim() || m.model.trim())
export const machineLabel = m => [m.maker, m.model].map(v => v.trim()).filter(Boolean).join(' ') || '機械（未入力）'

export function sanitizePublicProfile(raw) {
  const p = emptyPublicProfile()
  for (const [key, , , limit] of PUBLIC_FIELDS) p[key] = string(raw?.[key]).slice(0, limit)
  if (p.role && !ROLES.includes(p.role)) p.role = ''
  p.machines = sanitizeMachines(raw?.machines)
  return p
}
export function sanitizePrivateProfile(raw) {
  const p = emptyPrivateProfile()
  for (const [key, , , limit] of PRIVATE_FIELDS) p[key] = string(raw?.[key]).slice(0, limit)
  return p
}
// 公開ページ・発表に出る項目だけを返す（非公開の項目が混ざらないことをここで保証する）
export const publicView = profile => sanitizePublicProfile(profile)
// アカウント画面の「入力済み」判定：Airbnb の「Personal info」のように、未入力の行を数える
export const missingPublic = p => PUBLIC_FIELDS.filter(([key]) => !String(p?.[key] || '').trim()).map(([, label]) => label)
export const missingPrivate = p => PRIVATE_FIELDS.filter(([key]) => !String(p?.[key] || '').trim()).map(([, label]) => label)
