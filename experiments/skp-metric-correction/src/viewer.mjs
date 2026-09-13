import * as T from '../vendor/three.module.js';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {createSKP as createBaseline} from '../baseline/skp-model.js';
import {createSKP} from './skp-model.js';
import {AUTHORED_RADII_M} from './wheel-spec.mjs';
import {measureModel,WHEELS} from './measurement.mjs';
import {PARTS} from './skp-parts.js';
import {createCatalog,positionAssembly} from './assembly-tree.js';
const el=id=>document.getElementById(id),stage=el('stage'),state={variant:'metricWheels',subject:'whole',exploded:false,transparent:false};
const labels={baseline:'旧モデル',metricOnly:'拡縮なし',metricWheels:'車輪径も修正'},f=v=>v.toFixed(2),engines=['engine','tank','aircleaner','muffler','recoil'];
const models={baseline:createBaseline(),metricOnly:createSKP({wheelBodyRadiiM:AUTHORED_RADII_M}),metricWheels:createSKP()},reports={};
for(const [id,m]of Object.entries(models)){reports[id]=measureModel(m);m.catalog=createCatalog(PARTS,m.details,'SKP-101W');}
let renderer,camera,scene,controls,reference,drawCount=0,errors=[];
function table(){
 const r=reports[state.variant],w=r.wheels.find(w=>w.id===state.subject);
 if(w)el('metrics').innerHTML=`<p><strong>${models[state.variant].parts[w.id].userData.name}</strong> ／ 組立時の計測</p><p>公称径 <b>${w.nominalDiameterMm}</b> mm → 外接径 <b class="number">${f(w.circumscribedDiameterMm)}</b> mm</p><p>左右幅 × 上下幅：${f(w.spanXYZmm[0])} × ${f(w.spanXYZmm[1])} mm</p><p>タイヤの断面半径の最大ばらつき：${w.smoothTire.maxRadialSpreadMm.toFixed(5)} mm</p><p>最下点 y：<b>${f(w.lowestYmm)}</b> mm ／ 車輪中心高：${f(w.axleCenterMm[1])} mm</p><p>幅・位置・取付：実機未確認。上下幅はラグ位相に依存。</p>`;
 else if(state.subject==='engine')el('metrics').innerHTML=`<p><strong>エンジン群は標準GB131の寸法へ置換していません。</strong></p><p>現在の包絡 X/Y/Z：${r.engineGroupXYZmm.map(f).join(' / ')} mm</p><p>搭載GB131LN-231：タンク4.8 L ／ 標準GB131：2.5 L。仕様と軸対応の差が未確定です。</p>`;
 else el('metrics').innerHTML=`<p><strong>全体外寸（組立状態）</strong> 長さ × 幅 × 高さ</p><p>公式：2200 × 1350 × 1350 mm</p><p>実メッシュ：<b>${[r.actual.xyzMm[0],r.actual.xyzMm[2],r.actual.xyzMm[1]].map(f).join(' × ')}</b> mm</p><p>差：${[r.deltaXYZmm[0],r.deltaXYZmm[2],r.deltaXYZmm[1]].map(v=>(v>=0?'+':'')+f(v)).join(' / ')} mm</p><p>全体へ合わせる拡縮：${state.variant==='baseline'?'あり（軸ごとに変形）':'なし'}。実物精度の合格判定は未実施。</p>`;
}
function audit(){el('audit').textContent=JSON.stringify({state,drawCount,canvasCount:document.querySelectorAll('canvas').length,errors,camera:camera?{position:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom}:null,measurements:reports[state.variant],modelVerified:false,documented3dParts:0},null,2);}
function referenceCircle(){
 if(reference){scene.remove(reference);reference.geometry.dispose();reference.material.dispose();reference=null;}
 const w=reports[state.variant].wheels.find(w=>w.id===state.subject);if(!w)return;
 const points=[];for(let i=0;i<=128;i++){const a=i*2*Math.PI/128;points.push(new T.Vector3(w.axleCenterMm[0]/1000+Math.cos(a)*w.nominalDiameterMm/2000,w.axleCenterMm[1]/1000+Math.sin(a)*w.nominalDiameterMm/2000,1));}
 reference=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0xbf3657,depthTest:false,transparent:true,opacity:.8}));reference.renderOrder=10;scene.add(reference);reference.visible=!state.exploded;
}
function update(){
 for(const [id,m]of Object.entries(models)){
  m.root.visible=id===state.variant;
  for(const [partId,g]of Object.entries(m.parts)){g.visible=state.subject==='whole'||(state.subject==='engine'?engines.includes(partId):partId===state.subject);g.traverse(o=>{if(o.isMesh){o.material.transparent=state.transparent&&g.userData.shell===true;o.material.opacity=o.material.transparent?.15:1;o.material.depthWrite=!o.material.transparent;}});}
  positionAssembly(m.parts,m.details,m.catalog,{scope:WHEELS.includes(state.subject)?state.subject:'machine',explode:state.exploded?1:0});m.root.updateMatrixWorld(true);
 }
 document.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.stage===state.variant));
 el('explode').textContent=state.exploded?'組立':'分解';el('explode').setAttribute('aria-pressed',state.exploded);el('transparent').setAttribute('aria-pressed',state.transparent);
 table();if(renderer){referenceCircle();render();}else audit();
}
function side(){
 const targets={whole:[0,.72,0],frontL:[.77,.175,0],frontR:[.77,.175,0],rearL:[-.37,.266,0],rearR:[-.37,.266,0],engine:[.53,.62,0]},t=new T.Vector3(...targets[state.subject]);
 controls.target.copy(t);camera.position.copy(t).add(new T.Vector3(0,0,5));camera.zoom=1;camera.userData.span=state.subject==='whole'?1.9:state.subject==='engine'?.85:.65;resize();controls.update();
}
function resize(){if(!renderer)return;const w=stage.clientWidth,h=stage.clientHeight,span=camera.userData.span||1.9;renderer.setSize(w,h);camera.left=-span*w/h/2;camera.right=span*w/h/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();render();}
function render(){if(!renderer)return;renderer.render(scene,camera);drawCount++;audit();}
try{
 renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xfafcfb);stage.append(renderer.domElement);
 scene=new T.Scene();camera=new T.OrthographicCamera(-1,1,1,-1,.01,30);scene.add(new T.HemisphereLight(0xffffff,0x778c8b,2.5));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(1,3,5);scene.add(sun);const fill=new T.DirectionalLight(0xffffff,1.5);fill.position.set(-2,1,-3);scene.add(fill);
 Object.values(models).forEach(m=>scene.add(m.root));
 const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-4,0,0),new T.Vector3(4,0,0)]),new T.LineBasicMaterial({color:0x8b9696}));scene.add(line);
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.addEventListener('change',render);new ResizeObserver(resize).observe(stage);side();
 el('status').textContent='3D表示中 ／ 固定倍率・実メッシュ計測';
}catch(e){errors.push(String(e));el('status').textContent='3Dを開けません。下の寸法表は利用できます。';renderer=null;for(const id of ['side','explode','transparent'])el(id).disabled=true;}
document.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>{state.variant=b.dataset.stage;update();});
el('subject').onchange=()=>{state.subject=el('subject').value;state.exploded=false;update();if(renderer)side();};
el('side').onclick=side;el('explode').onclick=()=>{state.exploded=!state.exploded;update();};el('transparent').onclick=()=>{state.transparent=!state.transparent;update();};el('phone').onclick=()=>{document.body.classList.toggle('phone');el('phone').textContent=document.body.classList.contains('phone')?'広い表示':'スマホ幅';resize();};
update();document.body.dataset.ready='true';
