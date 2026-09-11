// 生成物ビューアのHTML組み立て（スマホ確認優先・単一ファイル・データ埋め込み）。
// 左：実資料の図（取説から自動抽出）＋資料由来の部品位置ホットスポット
// 右：抽出寸法で組んだ概略3D（GLB）。テンプレート推定配置は「推定」と明示する。
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function buildViewerHtml({ machine, partsReport, figures, glbBase64, job }) {
  const docParts = partsReport.filter(p => /資料照合済み|documented/.test(p.positionBasis) || p.documented)
  const figureBlocks = figures.map((fig, fi) => {
    const spots = fig.positions.map(p => {
      const left = (p.x / fig.width * 100).toFixed(2)
      const top = (p.y / fig.height * 100).toFixed(2)
      return `<button class="spot" data-part="${esc(p.name)}" style="left:${left}%;top:${top}%" title="(${p.marker}) ${esc(p.name)}">${p.marker}</button>`
    }).join('')
    return `<section class="figure-wrap">
      <h2>実資料の図（取扱説明書 ${fig.page}ページ）</h2>
      <p class="note">丸数字＝資料の符号。位置は図中の符号と引出線から自動取得（画像出所: PDFオブジェクト、SHA-256 ${esc(fig.sha256?.slice(0, 12))}…）。</p>
      <div class="figure" id="fig${fi}"><img src="${fig.dataUri}" alt="各部の名称の図（取扱説明書より）">${spots}</div>
    </section>`
  }).join('')

  const rows = partsReport.map(p => `
    <tr data-part="${esc(p.name)}">
      <td>${p.marker ? `(${p.marker}) ` : ''}${esc(p.name)}</td>
      <td>${esc(p.evidenceLocation || '')}</td>
      <td class="${/資料/.test(p.positionBasis) ? 'doc' : ''}">${esc(p.positionBasis)}</td>
      <td>${p.meshTarget ? esc(p.meshTarget) : '—'}</td>
    </tr>`).join('')

  const specRows = (machine.specEvidence || []).map(e => `
    <tr><td>${esc(e.field)}</td><td>${esc(String(e.excerpt))}</td><td>${esc(e.location || '')}${e.column ? `／${esc(e.column)}列` : ''}</td></tr>`).join('')

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
#three{width:100%;max-width:760px;height:330px;border:1px solid #ddd;border-radius:8px;background:#fff;touch-action:none}
table{border-collapse:collapse;width:100%;max-width:760px;font-size:.78rem;background:#fff}
th,td{border:1px solid #ddd;padding:5px 7px;text-align:left;vertical-align:top}
th{background:#efece6}
tr.active{background:#fdeaea}
td.doc{color:#1b5e20;font-weight:600}
.legend{font-size:.75rem;color:#555;margin:6px 0}
code{font-size:.7rem;word-break:break-all}
</style></head><body>
<h1>${esc(machine.name)}（${esc(machine.machineId)}）</h1>
<p class="meta">入力「${esc(job.input)}」から自動生成（資料取得→抽出→生成→検査）。モデル版: ${esc(job.modelVersion || '')}／忠実度: ${esc(machine.fidelity)}＝外形概略。
寸法 全長${machine.dimensionsMm?.[0]}×全幅${machine.dimensionsMm?.[1]}×全高${machine.dimensionsMm?.[2]}mm${machine.massKg ? `・質量${machine.massKg}kg` : ''}（出所は下表）。</p>
${figureBlocks}
<section>
<h2>概略3D（抽出寸法によるスケール・部品はテンプレート推定配置）</h2>
<p class="note">この3Dの部品配置は推定であり、資料照合済みの位置は上の図のホットスポットが根拠です。ドラッグで回転、ピンチ/ホイールで拡大。</p>
<canvas id="three"></canvas>
</section>
<section>
<h2>部品照合表（${docParts.length}点が資料の図で位置確認済み）</h2>
<table><thead><tr><th>部品名（符号）</th><th>名称の根拠箇所</th><th>位置の根拠</th><th>3D対象</th></tr></thead>
<tbody>${rows}</tbody></table>
</section>
<section>
<h2>寸法の根拠（資料の該当箇所）</h2>
<table><thead><tr><th>項目</th><th>資料の記載（抜粋）</th><th>該当箇所</th></tr></thead><tbody>${specRows}</tbody></table>
<p class="note">資料: <code>${esc((machine.specEvidence || [])[0]?.url || '')}</code></p>
</section>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
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
const glb = Uint8Array.from(atob('${glbBase64}'), c => c.charCodeAt(0))
new GLTFLoader().parse(glb.buffer, '', g => {
  scene.add(g.scene)
  g.scene.traverse(o => { if (o.isMesh) meshes.set(o.name, o) })
  const box = new THREE.Box3().setFromObject(g.scene)
  const c = box.getCenter(new THREE.Vector3()); controls.target.copy(c); controls.update()
})
const resize = () => { const w = canvas.clientWidth || canvas.parentElement.clientWidth; renderer.setSize(w, 330, false); camera.aspect = w / 330; camera.updateProjectionMatrix() }
addEventListener('resize', resize); resize()
renderer.setAnimationLoop(() => renderer.render(scene, camera))
// 部品名 → メッシュID の対応（照合表から）
const meshByPart = new Map()
document.querySelectorAll('tbody tr[data-part]').forEach(tr => {
  const target = tr.children[3].textContent.trim()
  if (target && target !== '—') meshByPart.set(tr.dataset.part, target)
})
let activeName = null
function activate(name) {
  activeName = name
  document.querySelectorAll('.spot').forEach(s => s.classList.toggle('active', s.dataset.part === name))
  document.querySelectorAll('tr[data-part]').forEach(t => t.classList.toggle('active', t.dataset.part === name))
  for (const [n, m] of meshes) m.material.emissive?.setHex(0x000000)
  const meshId = meshByPart.get(name)
  if (meshId && meshes.get(meshId)) meshes.get(meshId).material.emissive.setHex(0xaa2222)
  const row = document.querySelector('tr[data-part="' + CSS.escape(name) + '"]')
  if (row && !row.matches(':hover')) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}
document.querySelectorAll('.spot,tr[data-part]').forEach(el => el.addEventListener('click', () => activate(el.dataset.part)))
</script>
</body></html>`
}
