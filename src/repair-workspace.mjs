import { newRecord } from './domain.js'
import { emptyRepair } from './repair-entry.mjs'
import { MACHINE_ID, MODEL_VERSION, MACHINE_NAME, ROOT_PART_ID, resolveMachineRef } from './machine/catalog.js'

export const isRepairRecord = record => record?.meta?.subject === 'machine_repair'

// The registry shares the UI/record contract, not dimensions or repair instructions.
// Only this real catalog is registered. Test descriptors are never shipped here.
export const REPAIR_MACHINES = Object.freeze([Object.freeze({
  machineId: MACHINE_ID, modelVersion: MODEL_VERSION, rootPartId: ROOT_PART_ID,
  maker: 'クボタ', model: MACHINE_NAME, name: `クボタ ${MACHINE_NAME}`,
  aliases: Object.freeze(['Kubota']), guideKey: 'skp-power', resolveRef: resolveMachineRef,
  // 探すの分類チップに載せるための分類名（src/search.js の MACHINE_CATEGORIES）。meta.crop へ写す。
  category: '野菜関連機器',
})])

const fields = ['machineId', 'modelVersion', 'rootPartId', 'maker', 'model', 'name']
const pairKey = (machineId, modelVersion) => JSON.stringify([machineId, modelVersion])
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
function checkedDescriptor(value) {
  if (!isObject(value) || fields.some(key => typeof value[key] !== 'string' || !value[key].trim()) ||
      typeof value.resolveRef !== 'function' ||
      (value.aliases !== undefined && (!Array.isArray(value.aliases) || value.aliases.some(x => typeof x !== 'string'))) ||
      (value.guideKey !== undefined && typeof value.guideKey !== 'string') ||
      (value.category !== undefined && typeof value.category !== 'string')) {
    throw new TypeError('機械の登録情報を確認できません。')
  }
  return Object.freeze({ ...value, aliases: Object.freeze([...(value.aliases || [])]) })
}

export function createRepairRegistry(descriptors) {
  if (!Array.isArray(descriptors)) throw new TypeError('機械の登録一覧を確認できません。')
  const entries = Object.freeze(descriptors.map(checkedDescriptor))
  const byPair = new Map()
  const machineIds = new Set()
  for (const descriptor of entries) {
    const key = pairKey(descriptor.machineId, descriptor.modelVersion)
    if (byPair.has(key)) throw new Error('同じ機械・モデル版は重複登録できません。')
    byPair.set(key, descriptor)
    machineIds.add(descriptor.machineId)
  }
  function resolve(raw) {
    const ref = isObject(raw) ? Object.freeze({ machineId: raw.machineId, modelVersion: raw.modelVersion, partId: raw.partId }) : raw
    const result = (status, descriptor = null, node = null) => ({
      ref, status, descriptor, node,
      machineLabel: descriptor?.name || (typeof ref?.machineId === 'string' ? ref.machineId : ''),
      partLabel: status === 'whole' ? '機械全体' : status === 'resolved' ? node.name :
        status === 'unselected' ? '部品未選択' : '対象部品を確認できません',
    })
    if (ref == null) return result('unselected')
    if (!isObject(ref) || ['machineId', 'modelVersion', 'partId'].some(key => typeof ref[key] !== 'string') || !ref.machineId.trim()) return result('invalid')
    if (!machineIds.has(ref.machineId)) return result('unknown-machine')
    const descriptor = byPair.get(pairKey(ref.machineId, ref.modelVersion))
    if (!descriptor) return result('unknown-version')
    if (!ref.partId) return result('unselected', descriptor)
    // A resolver cannot silently replace an unknown part with its root or another part.
    let resolved
    try { resolved = descriptor.resolveRef(ref) } catch { return result('invalid', descriptor) }
    if (resolved?.status === 'unknown-part') return result('unknown-part', descriptor)
    if (!['whole', 'resolved'].includes(resolved?.status) || !isObject(resolved.node) ||
        resolved.node.id !== ref.partId || typeof resolved.node.name !== 'string') return result('invalid', descriptor)
    const status = ref.partId === descriptor.rootPartId ? 'whole' : 'resolved'
    return result(status, descriptor, resolved.node)
  }
  return Object.freeze({ descriptors: entries, resolve })
}

const repairRegistry = createRepairRegistry(REPAIR_MACHINES)
export const repairLookup = (ref, registry = repairRegistry) => registry.resolve(ref)

export function newRepairRecord(descriptor) {
  const registry = createRepairRegistry([descriptor])
  const machine = registry.descriptors[0]
  const machineRef = { machineId: machine.machineId, modelVersion: machine.modelVersion, partId: machine.rootPartId }
  if (registry.resolve(machineRef).status !== 'whole') throw new Error('機械全体の登録情報を確認できません。')
  const record = newRecord('trouble')
  record.title = machine.name
  record.meta.subject = 'machine_repair'
  record.meta.machineRef = machineRef
  // 保存層（toRow）は meta.crop を category にも写すので、作成時から両方を揃えて往復差を出さない。
  record.meta.crop = machine.category || ''
  if (machine.category) record.category = machine.category
  record.meta.repair = { ...emptyRepair(), machine: { maker: machine.maker, model: machine.model, serial: '', hours: '' } }
  return record
}

// 登録（3D）のない機械の修理記録。機械参照は持たず、メーカー・型式は本人の入力だけで表す。
// 型番文字列から登録機種を推測して代用しない。
export function newFreeRepairRecord(text = '') {
  const label = String(text || '').trim().slice(0, 200)
  const record = newRecord('trouble')
  record.title = label || '機械の修理'
  record.meta.subject = 'machine_repair'
  record.meta.machineRef = null
  record.meta.repair = { ...emptyRepair(), machine: { maker: '', model: label, serial: '', hours: '' } }
  return record
}

const normalizeSearch = value => String(value || '').normalize('NFKC').toLowerCase()
  .replace(/[‐‑‒–—−]/g, '-').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))

export function searchRepairMachines(query, descriptors = REPAIR_MACHINES) {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean)
  return descriptors.filter(descriptor => {
    const text = normalizeSearch([descriptor.maker, descriptor.model, descriptor.name, descriptor.machineId, ...(descriptor.aliases || [])].join(' '))
    return terms.every(term => text.includes(term))
  })
}
