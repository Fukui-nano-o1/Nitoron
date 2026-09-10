import { METRICS, number } from './domain.js'
// 比較表の数値セル。元データの単位をそのまま示し、未入力は「未記載」、入力された0は0、数値でない記載は記載どおりに見せる。
export const BLANK = '未記載'
export function metricCell(value, unit) {
  if (value == null || String(value).trim() === '') return { kind: 'blank', text: BLANK }
  const n = number(value)
  if (n === null) return { kind: 'text', text: `${String(value).trim()}（記載どおり・${unit}換算なし）` }
  return { kind: 'number', value: n, text: `${format(n)} ${unit}` }
}
// 10a換算：面積が数値で0より大きく、値も数値のときだけ計算する。
export function per10aCell(value, area, unit) {
  const cell = metricCell(value, unit)
  if (cell.kind !== 'number') return cell.kind === 'blank' ? cell : { kind: 'blank', text: `換算不可（${cell.text}）` }
  const a = number(area)
  if (a === null || a <= 0) return { kind: 'blank', text: '換算不可（面積未記載）' }
  const n = cell.value / a * 10
  return Number.isFinite(n) ? { kind: 'number', value: n, text: `${format(n)} ${unit}` } : { kind: 'blank', text: '換算不可' }
}
// 収支差額：売上と経費が両方数値のときだけ計算する。
export function balanceCell(revenue, cost, area, basis) {
  const r = number(revenue), c = number(cost)
  if (revenue == null || String(revenue).trim() === '' || cost == null || String(cost).trim() === '') return { kind: 'blank', text: '未算出（売上・経費のどちらかが未記載）' }
  if (r === null || c === null) return { kind: 'blank', text: '未算出（数値でない記載あり）' }
  let n = r - c
  if (basis === '10a') { const a = number(area); if (a === null || a <= 0) return { kind: 'blank', text: '換算不可（面積未記載）' }; n = n / a * 10 }
  return { kind: 'number', value: n, text: `${format(n)} 円` }
}
export const canConvert = metas => metas.some(m => number(m.areaA) > 0 && METRICS.some(([key]) => number(m[key]) !== null))
export const conditionText = m => [m.areaA ? `面積 ${m.areaA} a` : '面積 未記載', m.start || m.end ? `期間 ${m.start || '？'}〜${m.end || '？'}` : '期間 未記載'].join(' · ')
const format = n => new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 }).format(n)
