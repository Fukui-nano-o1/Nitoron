// 分野⑦「機械の解体新書」：機械修理記録の対象参照（meta.subject / meta.machineRef）の解釈。
// 参照の形は domain.js の sanitizeMachineRef が保証する。ここでは表示と状態の判定だけを行う。
// 初回対象は SKP-101W の1機種、1記録につき対象1か所。
export const MACHINE_SUBJECT = 'machine_repair'
// 「機械全体」を明示指定する予約 partId。部品未選択（''）とは区別する。
export const WHOLE_MACHINE = 'whole'
export const SUBJECTS = [['', '通常'], [MACHINE_SUBJECT, '機械修理']]

// 機種カタログ。versions[modelVersion].parts[partId] = { name } は既存3Dソース（SKP-101W / 農機 PARTS LAB）の
// 部品ID・部品名を移植して登録する。登録前は具体的な部品IDを検証できず、'unknown-version' として扱う。
// 同じIDを別部品に再利用しない。表示名や配列順を識別子にしない。
export const MACHINES = {
  'skp-101w': { name: 'クボタ SKP-101W', versions: {} },
}

// 参照の解決。区別する状態：
//   none            … 機械修理の記録ではない
//   unselected      … 機種・部品が未選択（下書きとして有効）
//   whole           … 機械全体を明示指定
//   part            … 部品を特定できた（partName あり）
//   unknown-machine … 機種IDをカタログで確認できない
//   unknown-version … モデル版をカタログで確認できない
//   unknown-part    … 版はあるが部品IDを確認できない
// unknown-* は「対象部品を確認できません」と表示し、全体表示または文字表示へ戻す。推測でズームしない。
export function resolveMachineRef(meta) {
  if (meta?.subject !== MACHINE_SUBJECT) return { status: 'none', machineName: '', partName: '' }
  const ref = meta.machineRef
  if (!ref) return { status: 'unselected', machineName: '', partName: '' }
  const machine = MACHINES[ref.machineId]
  if (!machine) return { status: 'unknown-machine', machineName: ref.machineId, partName: '' }
  if (ref.partId === WHOLE_MACHINE) return { status: 'whole', machineName: machine.name, partName: '機械全体' }
  if (!ref.partId) return { status: 'unselected', machineName: machine.name, partName: '' }
  const version = machine.versions[ref.modelVersion]
  if (!version) return { status: 'unknown-version', machineName: machine.name, partName: '' }
  const part = version.parts?.[ref.partId]
  if (!part) return { status: 'unknown-part', machineName: machine.name, partName: '' }
  return { status: 'part', machineName: machine.name, partName: part.name }
}

// カード・詳細・編集で共用する対象表示。アニメーションを見なくても対象が分かる文字列。
export function machineTargetLabel(resolution) {
  switch (resolution.status) {
    case 'none': return ''
    case 'unselected': return resolution.machineName ? `${resolution.machineName} · 部品未選択` : '機種・部品未選択'
    case 'whole': return `${resolution.machineName} · 機械全体`
    case 'part': return `${resolution.machineName} · ${resolution.partName}`
    default: return `${resolution.machineName || '機種不明'} · 対象部品を確認できません`
  }
}
