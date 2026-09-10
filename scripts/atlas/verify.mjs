// 生成物の検査。AIや生成処理の自己申告ではなく、成果物どうしの対応を機械的に照合する。
export function verifyMachine(machine, glbBuffer) {
  const problems = []
  const jsonLength = glbBuffer.readUInt32LE(12)
  const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString())
  const glbNodeNames = new Set((gltf.nodes || []).map(n => n.name))
  // 1. 公開する全部品が根拠情報を持つ
  for (const part of machine.parts) if (!part.evidence?.url) problems.push(`部品「${part.name}」に根拠資料がない`)
  // 2. メッシュ対応を持つ部品は、GLB内に同名ノードが実在する
  for (const part of machine.parts) if (part.slot && !glbNodeNames.has(part.slot)) problems.push(`部品「${part.name}」のメッシュ ${part.slot} がGLBにない`)
  // 3. 位置不明の部品はメッシュを持たない（当て推量の強調をしない）
  for (const part of machine.parts) if (part.positional === 'unknown' && part.slot) problems.push(`位置不明の部品「${part.name}」がメッシュを持っている`)
  // 4. 寸法の妥当性（0.1m〜20m）と根拠
  for (const mm of machine.dimensionsMm) if (!(mm >= 100 && mm <= 20000)) problems.push(`寸法 ${mm}mm が妥当範囲外`)
  for (const key of ['lengthMm', 'widthMm', 'heightMm']) if (!machine.specEvidence.some(e => e.field === key)) problems.push(`寸法 ${key} の根拠がない`)
  // 5. 階層の親が実在する
  const ids = new Set(machine.nodes.map(n => n.id))
  for (const node of machine.nodes) if (node.parent && !ids.has(node.parent)) problems.push(`ノード ${node.id} の親 ${node.parent} がない`)
  return { ok: problems.length === 0, problems }
}
