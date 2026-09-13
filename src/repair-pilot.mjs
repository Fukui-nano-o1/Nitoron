import { MACHINE_ID, MODEL_VERSION, resolveMachineRef } from './machine/catalog.js'
import { GUIDES, META, pageLink } from '../vendor/parts-lab/dist/skp-parts.js'

// One existing documented guide, independent of Three.js and of the repair outcome.
export const POWER_GUIDE = GUIDES.power
export const PILOT_REF = Object.freeze({ machineId: MACHINE_ID, modelVersion: MODEL_VERSION, partId: 'aircleaner' })
export const OBSERVED = Object.freeze({ yes: 'ほこりやごみの詰まりが見える', no: '見える範囲では詰まりが見当たらない', unknown: '確認できない・未確認' })
export const ACTION = Object.freeze({ performed: '実施した', 'not-performed': '実施していない' })
export const REASSESSMENT = Object.freeze({ improved: '症状が改善したと本人が確認', unchanged: '症状は変わらない', 'not-assessed': '再確認していない・判断できない', consult: '自分では進めず相談する' })
export const newRepairDraft = () => ({ observed: '', action: '', actionNote: '', reassessment: '', reassessmentNote: '', changeTarget: false })

export function isPilotMachine(meta) {
  return meta?.subject === 'machine_repair' && meta.machineRef?.machineId === MACHINE_ID &&
    meta.machineRef?.modelVersion === MODEL_VERSION && Boolean(resolveMachineRef(meta.machineRef).node)
}
function choice(map, value, label) { if (!Object.hasOwn(map, value)) throw new Error(label + 'を選んでください。'); return map[value] }
function note(value, label) {
  if (typeof value !== 'string' || value.length > 1000) throw new Error(label + 'は1000文字以内で入力してください。')
  return value.trim()
}
export function repairDraftText(draft, date) {
  if (!draft || typeof draft !== 'object' || typeof draft.changeTarget !== 'boolean') throw new Error('記録案が不正です。')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || Number.isNaN(Date.parse(date + 'T00:00:00Z')) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) throw new Error('記録日を確認してください。')
  const observed = choice(OBSERVED, draft.observed, '目視での確認結果')
  const action = choice(ACTION, draft.action, '対処の実施状況')
  const reassessment = choice(REASSESSMENT, draft.reassessment, '対処後の状態')
  const actionNote = note(draft.actionNote, '実施内容'), reassessmentNote = note(draft.reassessmentNote, '再確認の内容')
  if (draft.action === 'performed' && !actionNote) throw new Error('実際に行ったことを入力してください。')
  if (['improved', 'unchanged'].includes(draft.reassessment)) {
    if (draft.action !== 'performed') throw new Error('対処後の改善・変化なしは、対処を実施した場合に選べます。')
    if (!reassessmentNote) throw new Error('何を見て、どう再確認したかを入力してください。')
  }
  const heading = `SKP-101W：${POWER_GUIDE.label}（${date}）`
  return {
    action: [heading, '対処の実施状況：' + action, actionNote && '本人の記録：' + actionNote].filter(Boolean).join('\n'),
    result: [heading, '目視での確認：' + observed, '対処後の状態：' + reassessment, reassessmentNote && '本人の再確認記録：' + reassessmentNote,
      '症状の自己申告です。原因・修理完了を自動判定した記録ではありません。'].filter(Boolean).join('\n')
  }
}
function append(existing, addition) {
  if (typeof existing !== 'string') throw new Error('既存の記録形式を確認してください。')
  // Reopening with the same choices/date must not duplicate an already transferred entry.
  if (existing === addition || existing.startsWith(addition + '\n\n') || existing.endsWith('\n\n' + addition) || existing.includes('\n\n' + addition + '\n\n')) return existing
  const result = existing ? existing + '\n\n' + addition : addition
  if (result.length > 20000) throw new Error('追記すると項目の20000文字を超えます。元の記録を整理してからやり直してください。')
  return result
}
export function prepareRepairTransfer(meta, draft, { reviewed = false, date, expectedRef } = {}) {
  if (!isPilotMachine(meta)) throw new Error('この確認は、登録済みのSKP-101Wを対象にした記録で利用できます。')
  if (!expectedRef || ['machineId', 'modelVersion', 'partId'].some(key => expectedRef[key] !== meta.machineRef[key])) throw new Error('記録の対象が変わりました。確認内容を控え、閉じてから開き直してください。')
  if (reviewed !== true) throw new Error('追記する内容を確認してください。')
  if (!Array.isArray(meta.sources)) throw new Error('既存の出典形式を確認してください。')
  const text = repairDraftText(draft, date)
  const action = append(meta.action, text.action), result = append(meta.result, text.result)
  const sources = [...meta.sources]
  for (const page of [53, 58, 74]) {
    const url = pageLink(page)
    if (!sources.some(source => source?.url === url)) sources.push({ id: `repair-power-manual-${page}`, title: `${META.manualCode} 印刷p.${page}（PDF ${page + 18}ページ）`, url, date: '' })
  }
  if (new Set(sources.map(source => source?.id)).size !== sources.length) throw new Error('出典IDが重複します。既存の出典を確認してください。')
  return { ...meta, action, result, sources, inputMode: 'sections', machineRef: draft.changeTarget ? { ...PILOT_REF } : meta.machineRef }
}
