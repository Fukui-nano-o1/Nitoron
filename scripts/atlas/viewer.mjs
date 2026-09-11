// 生成物ビューアのHTML組み立て（スマホ確認優先・単一ファイル・外部CDN依存なし）。
// - 3D表示は既存同梱のThree.js（vendor/parts-lab/dist/vendor、MIT。ライセンス表記は
//   埋め込みソース内の@licenseヘッダとTHREE-LICENSE.txtの記載を保持）をdata URIのimport mapで解決する。
// - 3Dモデルは検査済みの部品ノード（machine nodes）から直接組み立てる（GLBと同一の宣言データ）。
// - 2D（実資料の図・ホットスポット・表）は3Dの読込失敗と独立に動作する。
// - 3Dの部品配置はテンプレート推定であり、資料照合済みとは表示しない（2D照合と別集計）。
import { readFile } from 'node:fs/promises'

const VENDOR = new URL('../../vendor/parts-lab/dist/vendor/', import.meta.url)
const jsDataUri = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export async function buildViewerHtml({ machine, partsReport, figures, job }) {
  // 同梱Three.js（module分割）をdata URIで自己完結させる。相対importは埋め込み用の裸名へ書き換える。
  const coreSrc = await readFile(new URL('three.core.js', VENDOR), 'utf8')
  const threeSrc = (await readFile(new URL('three.module.js', VENDOR), 'utf8')).replaceAll('./three.core.js', 'nitoron-three-core')
  const orbitSrc = (await readFile(new URL('OrbitControls.js', VENDOR), 'utf8')).replaceAll('./three.module.js', 'nitoron-three')
  const importMap = JSON.stringify({ imports: {
    'nitoron-three-core': jsDataUri(coreSrc),
    'nitoron-three': jsDataUri(threeSrc),
    'nitoron-orbit': jsDataUri(orbitSrc),
  } })

  const documented2d = partsReport.filter(p => p.documented)
  const leader = documented2d.filter(p => /引出線/.test(p.positionBasis)).length
  const markerOnly = documented2d.length - leader
  const meshed = partsReport.filter(p => p.meshTarget).length

  const figureBlocks = figures.map((fig, fi) => {
    const spots = fig.positions.map(p => {
      const left = (p.x / fig.width * 100).toFixed(2)
      const top = (p.y / fig.height * 100).toFixed(2)
      return `<button class="spot" data-part="${esc(p.name)}" style="left:${left}%;top:${top}%" title="(${p.marker}) ${esc(p.name)}">${p.marker}</button>`
    }).join('')
    return `<section class="figure-wrap">
      <h2>実資料の図（取扱説明書 ${fig.page}ページ）</h2>
      <p class="note">丸数字＝資料の符号。位置は図中の符号と引出線から自動取得（画像出所: 取説PDF、SHA-256 ${esc(fig.sha256?.slice(0, 12))}…）。この2D照合は3D表示と独立に動作します。</p>
      <div class="figure" id="fig${fi}"><img src="${fig.dataUri}" alt="各部の名称の図（取扱説明書より）">${spots}</div>
    </section>`
  }).join('')

  const rows = partsReport.map(p => `
    <tr data-part="${esc(p.name)}">
      <td>${p.marker ? `(${p.marker}) ` : ''}${esc(p.name)}</td>
      <td>${esc(p.evidenceLocation || '')}</td>
      <td class="${p.documented ? 'doc' : ''}">${esc(p.positionBasis)}</td>
      <td>${p.meshTarget ? esc(p.meshTarget) + '（配置は推定）' : '—'}</td>
    </tr>`).join('')

  const specRows = (machine.specEvidence || []).map(e => `
    <tr><td>${esc(e.field)}</td><td>${esc(String(e.excerpt))}</td><td>${esc(e.location || '')}${e.column ? `／${esc(e.column)}列` : ''}</td></tr>`).join('')

  const nodesJson = JSON.stringify(machine.nodes.filter(n => n.geom).map(n => ({ id: n.id, name: n.name, geom: n.geom })))
  const meshNamesJson = JSON.stringify(Object.fromEntries(partsReport.filter(p => p.meshTarget).map(p => [p.name, p.meshTarget])))

  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(machine.name)}｜解体新書（工程A実証）</title>
<style>
:root{color-scheme:light}
body{font-family:system-ui,sans-serif;margin:0;padding:0 16px 48px;background:#f7f6f3;color:#1c1c1a}
h1{font-size:1.15rem;margin:16px 0 4px}h2{font-size:1rem;margin:20px 0 6px}
.meta{font-size:.8rem;color:#666;margin:0 0 12px}
.note{font-size:.75rem;color:#777;margin:2px 0 8px}
.figure{position:relative;max-width:760px}
.figure img{width:100%;display:block;border:1px solid #ddd;border-radius:8px;background:#fff}
.spot{position:absolute;transform:translate(-50%,-50%);min-width:22px;height:22px;border-radius:50%;
 border:2px solid #c62828;background:rgba(255,255,255,.88);color:#c62828;font-size:.7rem;font-weight:700;padding:0;cursor:pointer}
.spot.active{background:#c62828;color:#fff;z-index:2}
#threeWrap{position:relative;max-width:760px}
#three{width:100%;height:330px;border:1px solid #ddd;border-radius:8px;background:#fff;touch-action:none;display:block}
#threeStatus{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#888;font-size:.85rem;pointer-events:none}
table{border-collapse:collapse;width:100%;max-width:760px;font-size:.78rem;background:#fff}
th,td{border:1px solid #ddd;padding:5px 7px;text-align:left;vertical-align:top}
th{background:#efece6}
tr.active{background:#fdeaea}
td.doc{color:#1b5e20;font-weight:600}
code{font-size:.7rem;word-break:break-all}
</style></head><body>
<h1>${esc(machine.name)}（${esc(machine.machineId)}）</h1>
<p class="meta">入力「${esc(job.input)}」から自動生成（資料取得→抽出→生成→検査）。モデル版: ${esc(job.modelVersion || '')}／忠実度: ${esc(machine.fidelity)}＝外形概略。
寸法 全長${machine.dimensionsMm?.[0]}×全幅${machine.dimensionsMm?.[1]}×全高${machine.dimensionsMm?.[2]}mm${machine.massKg ? `・質量${machine.massKg}kg` : ''}（出所は下表）。<br>
位置照合の集計（2Dと3Dは別集計）：<strong>2D図上 ${documented2d.length}点</strong>（引出線の指し先${leader}・符号位置${markerOnly}）／<strong>資料照合済みの3D配置 0点</strong>（3Dメッシュ${meshed}点はテンプレート推定配置）。</p>
${figureBlocks}
<section>
<h2>概略3D（抽出寸法によるスケール・部品はテンプレート推定配置）</h2>
<p class="note">この3Dの部品配置は推定であり、資料で位置照合した3D配置は現時点で0点です。資料照合済みの位置は上の図の2Dホットスポットが根拠です。ドラッグで回転、ピンチ／ホイールで拡大。3D表示: 同梱three.js r180（MIT License・外部CDN不使用）。</p>
<div id="threeWrap"><canvas id="three"></canvas><div id="threeStatus">3Dを初期化しています…</div></div>
</section>
<section>
<h2>部品照合表（2D照合${documented2d.length}点／3D照合0点）</h2>
<table><thead><tr><th>部品名（符号）</th><th>名称の根拠箇所</th><th>位置の根拠</th><th>3D対象</th></tr></thead>
<tbody>${rows}</tbody></table>
</section>
<section>
<h2>寸法の根拠（資料の該当箇所）</h2>
<table><thead><tr><th>項目</th><th>資料の記載（抜粋）</th><th>該当箇所</th></tr></thead><tbody>${specRows}</tbody></table>
<p class="note">資料: <code>${esc((machine.specEvidence || [])[0]?.url || '')}</code></p>
</section>
<script>
// 2D照合の操作（3Dの読込結果に依存しない）
(function () {
  var activeName = null
  function activate(name) {
    activeName = name
    document.querySelectorAll('.spot').forEach(function (s) { s.classList.toggle('active', s.dataset.part === name) })
    document.querySelectorAll('tr[data-part]').forEach(function (t) { t.classList.toggle('active', t.dataset.part === name) })
    document.dispatchEvent(new CustomEvent('nitoron:part', { detail: { name: name } }))
  }
  window.nitoronActivate = activate
  document.querySelectorAll('.spot,tr[data-part]').forEach(function (el) {
    el.addEventListener('click', function () { activate(el.dataset.part) })
  })
  // 3D初期化の見届け（失敗しても2Dはそのまま使える）
  setTimeout(function () {
    var s = document.getElementById('threeStatus')
    if (!window.__nitoron3dReady && s) s.textContent = '3D表示を初期化できませんでした（この端末のWebGL/モジュール対応をご確認ください）。2D照合は上の図で操作できます。'
  }, 5000)
})()
</script>
<script type="importmap">${importMap}</script>
<script type="module">
import * as THREE from 'nitoron-three'
import { OrbitControls } from 'nitoron-orbit'
const NODES = ${nodesJson}
const MESH_BY_PART = ${meshNamesJson}
const DIMS_MM = ${JSON.stringify(machine.dimensionsMm || null)}
try {
  const canvas = document.getElementById('three')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xffffff)
  const camera = new THREE.PerspectiveCamera(50, 2, 0.01, 50)
  camera.position.set(2.2, 1.6, 2.6)
  scene.add(new THREE.AmbientLight(0xffffff, 0.9))
  const dir = new THREE.DirectionalLight(0xffffff, 1.4); dir.position.set(3, 5, 2); scene.add(dir)
  const controls = new OrbitControls(camera, canvas)
  const meshes = new Map()
  const group = new THREE.Group()
  for (const node of NODES) {
    const geometry = node.geom.type === 'cylinder'
      ? new THREE.CylinderGeometry(node.geom.size[0], node.geom.size[0], node.geom.size[1], 24)
      : new THREE.BoxGeometry(node.geom.size[0], node.geom.size[1], node.geom.size[2])
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x8a8f98 }))
    if (node.geom.axis === 'z') mesh.rotation.x = Math.PI / 2
    mesh.position.set(node.geom.position[0], node.geom.position[1], node.geom.position[2])
    mesh.name = node.id
    group.add(mesh)
    meshes.set(node.id, mesh)
  }
  // 資料寸法（全長×全高×全幅）の外形枠。寸法は諸元表由来＝資料根拠、内部配置の主張ではない。
  if (DIMS_MM) {
    const [L, W, H] = [DIMS_MM[0] / 1000, DIMS_MM[1] / 1000, DIMS_MM[2] / 1000]
    const envelope = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(L, H, W)),
      new THREE.LineBasicMaterial({ color: 0x9aa3ad }))
    envelope.position.set(0, H / 2, 0)
    group.add(envelope)
  }
  scene.add(group)
  const box = new THREE.Box3().setFromObject(group)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3()).length()
  controls.target.copy(center)
  camera.position.set(center.x + size * 0.8, center.y + size * 0.55, center.z + size * 0.9)
  controls.update()
  const resize = () => { const w = canvas.clientWidth || canvas.parentElement.clientWidth; renderer.setSize(w, 330, false); camera.aspect = w / 330; camera.updateProjectionMatrix() }
  addEventListener('resize', resize); resize()
  renderer.setAnimationLoop(() => renderer.render(scene, camera))
  // 部品選択（2D側イベント）→ 対応メッシュがあれば強調（配置は推定と表で明示）
  document.addEventListener('nitoron:part', e => {
    for (const m of meshes.values()) m.material.emissive.setHex(0x000000)
    const meshId = MESH_BY_PART[e.detail.name]
    if (meshId && meshes.get(meshId)) meshes.get(meshId).material.emissive.setHex(0xaa2222)
  })
  // 3D側のタップでも部品を選択できる（対応メッシュ→照合表・図と連動）
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2()
  canvas.addEventListener('pointerup', ev => {
    const r = canvas.getBoundingClientRect()
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ptr, camera)
    const hit = ray.intersectObjects([...meshes.values()])[0]
    if (!hit) return
    const partName = Object.keys(MESH_BY_PART).find(n => MESH_BY_PART[n] === hit.object.name)
    if (partName && window.nitoronActivate) window.nitoronActivate(partName)
  })
  window.__nitoron3dReady = true
  document.getElementById('threeStatus').textContent = ''
} catch (error) {
  document.getElementById('threeStatus').textContent = '3D表示の初期化に失敗: ' + error.message + '（2D照合は上の図で操作できます）'
}
</script>
</body></html>`
}
