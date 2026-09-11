// 概略3Dの組み立て：資料から抽出した寸法でカテゴリ別テンプレートをパラメータ化し、
// 検証可能な宣言データ（nodes JSON）を返す。任意コードは生成しない。
// すべての位置は positional:'approx'（概略）。資料で位置を確認できない部品はメッシュを持たせない。
// 実機の分解順序・締付値・正確な内部配置を主張しない。

// テンプレートの各スロット：資料の部品名と対応させるためのキーワードつき。
// キーワードは名称の先頭一致を基本にする（「ハンドル高さ調節レバー」を「ハンドル」本体に対応させない）
const TILLER_SLOTS = [
  { id: 'engine', name: 'エンジン', keywords: /^エンジン$|^engine$/i, geom: d => ({ type: 'box', size: [d.L * .35, d.H * .3, d.W * .6], position: [d.L * .05, d.H * .52, 0] }) },
  { id: 'fueltank', name: '燃料タンク', keywords: /^燃料タンク/, geom: d => ({ type: 'box', size: [d.L * .2, d.H * .12, d.W * .4], position: [d.L * .05, d.H * .72, 0] }) },
  { id: 'handle', name: 'ハンドル', keywords: /^ハンドル$|^ハンドル[（(]/, geom: d => ({ type: 'box', size: [d.L * .5, d.H * .06, d.W * .5], position: [-d.L * .35, d.H * .8, 0] }) },
  { id: 'rotary', name: 'ロータリ（耕うん爪）', keywords: /^ロータリ$|^ロータリ[（(]|耕うん爪/, geom: d => ({ type: 'cylinder', size: [d.H * .18, d.W * .9], position: [d.L * .1, d.H * .18, 0], axis: 'z' }) },
  { id: 'wheel', name: '車輪', keywords: /^車輪|^タイヤ|^移動輪/, geom: d => ({ type: 'cylinder', size: [d.H * .12, d.W * .12], position: [-d.L * .25, d.H * .12, 0], axis: 'z' }) },
  { id: 'cover', name: 'カバー', keywords: /^ベルトカバー|^カバー|^フェンダー/, geom: d => ({ type: 'box', size: [d.L * .3, d.H * .05, d.W * .95], position: [d.L * .1, d.H * .34, 0] }) },
  { id: 'resistbar', name: '抵抗棒', keywords: /^抵抗棒/, geom: d => ({ type: 'box', size: [d.L * .05, d.H * .35, d.W * .05], position: [-d.L * .42, d.H * .2, 0] }) },
]
const GENERIC_SLOTS = [
  { id: 'body', name: '本体', keywords: /本体|body/, geom: d => ({ type: 'box', size: [d.L * .8, d.H * .6, d.W * .8], position: [0, d.H * .4, 0] }) },
]

export function assembleMachine({ machineId, name, category, spec, partNames }) {
  // 寸法の根拠がなければ組み立てない（想像でスケールを確定しない）
  if (!(spec.lengthMm > 0 && spec.widthMm > 0 && spec.heightMm > 0)) return { status: 'insufficient-materials', missing: ['lengthMm', 'widthMm', 'heightMm'].filter(k => !(spec[k] > 0)) }
  const d = { L: spec.lengthMm / 1000, W: spec.widthMm / 1000, H: spec.heightMm / 1000 }
  const slots = category === 'walk-behind-tiller' ? TILLER_SLOTS : GENERIC_SLOTS
  const nodes = [{ id: 'machine', name, kind: 'machine', parent: null, geom: null, positional: 'approx' }]
  const parts = []
  for (const part of partNames) {
    const slot = slots.find(s => s.keywords.test(part.name) && !parts.some(p => p.slot === s.id))
    // 資料の図から取得した位置（2D）がある部品は documented-2d。3Dメッシュの置き場所自体は
    // 引き続きテンプレート推定（positionBasis）であり、両者を混同しない。
    const positional = part.positionEvidence ? 'documented-2d' : slot ? 'approx' : 'unknown'
    if (slot) {
      nodes.push({ id: slot.id, name: part.name, kind: 'part', parent: 'machine', geom: slot.geom(d), positional, positionBasis: 'template-estimate' })
      parts.push({ id: slot.id, name: part.name, slot: slot.id, positional, positionBasis: 'template-estimate', evidence: part.evidence, positionEvidence: part.positionEvidence })
    } else {
      // メッシュなしの部品：位置が資料図で確認できたものは documented-2d（図上の該当位置つき）、
      // できないものは unknown として資料の該当箇所へ案内するだけに留める
      parts.push({ id: `doc-${parts.length}`, name: part.name, slot: null, positional, evidence: part.evidence, positionEvidence: part.positionEvidence })
    }
  }
  if (!parts.some(p => p.slot || p.positional === 'documented-2d')) return { status: 'insufficient-materials', missing: ['mappable-parts'] }
  return { status: 'ok', machine: { machineId, name, category, dimensionsMm: [spec.lengthMm, spec.widthMm, spec.heightMm], massKg: spec.massKg ?? null, fidelity: 'schematic-exterior', placementBasis: 'template-ratio-estimate', nodes, parts, specEvidence: spec.evidence } }
}
