// 宣言データ（nodes JSON）→ GLB。既存vendorのThree r180とGLTFExporterを使う（新規Three依存なし）。
import * as THREE from '../../vendor/parts-lab/dist/vendor/three.module.js'
import { GLTFExporter } from '../../vendor/parts-lab/dist/vendor/GLTFExporter.js'

// GLTFExporterのNode実行に必要な最小shim（vendor/parts-lab/scripts/export-model.mjs と同じ手法）
globalThis.FileReader ||= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onload?.({ target: this }); this.onloadend?.({ target: this }) }).catch(error => this.onerror?.(error)) }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = 'data:' + blob.type + ';base64,' + Buffer.from(result).toString('base64'); this.onload?.({ target: this }); this.onloadend?.({ target: this }) }).catch(error => this.onerror?.(error)) }
}

export async function buildGlb(machine) {
  const root = new THREE.Group()
  root.name = machine.machineId
  for (const node of machine.nodes) {
    if (!node.geom) continue
    const geometry = node.geom.type === 'cylinder'
      ? new THREE.CylinderGeometry(node.geom.size[0], node.geom.size[0], node.geom.size[1], 24)
      : new THREE.BoxGeometry(...node.geom.size)
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x8a8f98 }))
    if (node.geom.axis === 'z') mesh.rotation.x = Math.PI / 2
    mesh.position.set(...node.geom.position)
    mesh.name = node.id
    mesh.userData.partId = node.id
    root.add(mesh)
  }
  const result = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true, trs: true })
  const buffer = Buffer.from(result)
  // GLBヘッダ検査（magic・版・全長）
  if (buffer.readUInt32LE(0) !== 0x46546c67 || buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length) throw new Error('invalid GLB output')
  return buffer
}
