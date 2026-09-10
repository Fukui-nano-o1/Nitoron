// 分野⑦「機械の解体新書」：機械修理記録の対象（meta.subject / meta.machineRef）のNitoron側の窓口。
// カタログ・参照解決・IDの契約は提供された src/machine/catalog.js が唯一の正で、ここでは
// subject の確認とNitoron用の表示ラベル生成だけを行う。別のカタログやモデル版判定を作らない。
import { MACHINE_NAME, resolveMachineRef } from './machine/catalog.js'
export { MACHINE_ID, MODEL_VERSION, ROOT_PART_ID, MACHINE_NAME, resolveMachineRef } from './machine/catalog.js'
export const MACHINE_SUBJECT = 'machine_repair'
export const SUBJECTS = [['normal', '通常'], [MACHINE_SUBJECT, '機械修理']]

// 記録の対象を解決する。resolver の状態（whole / resolved / unselected /
// unknown-machine / unknown-version / unknown-part / invalid）をそのまま返し、
// カード・詳細・編集で共用する対象表示（アニメーションを見なくても対象が分かる文字列）を添える。
// unknown-* と invalid は「対象部品を確認できません」。推測で別部品に割り当てない。
export function resolveMachineTarget(meta) {
  if (meta?.subject !== MACHINE_SUBJECT) return { status: 'none', node: null, label: '' }
  const ref = meta.machineRef
  const { status, node } = resolveMachineRef(ref)
  switch (status) {
    case 'unselected': return { status, node, label: ref ? `${MACHINE_NAME} · 部品未選択` : '機種・部品未選択' }
    case 'whole': return { status, node, label: `${MACHINE_NAME} · 機械全体` }
    case 'resolved': return { status, node, label: `${MACHINE_NAME} · ${node.name}` }
    case 'unknown-version':
    case 'unknown-part': return { status, node, label: `${MACHINE_NAME} · 対象部品を確認できません` }
    default: return { status, node, label: '機種不明 · 対象部品を確認できません' }
  }
}
