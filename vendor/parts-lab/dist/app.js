import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {createTractor} from './model.js';
import * as TractorData from './parts.js';
import * as SKPData from './skp-parts.js';
import {createSKP} from './skp-model.js';
import {createCatalog,positionAssembly} from './assembly-tree.js';
import {FAULTS} from './skp-faults.js';
import {configureInspectionControls,setInspectionDragMode} from './camera-rig.js';

const isSKP=new URLSearchParams(location.search).get('model')!=='tractor';
const {PARTS,GUIDES}=isSKP?SKPData:TractorData;
const initialDescription=isSKP?'部品群をタップして選択し、内部を開いてください。':'分解スライダーを動かすと、外装と内部の部品が離れます。気になる部品を選んでください。';

const $=id=>document.getElementById(id);
const wrap=$('canvas-wrap'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const state={selected:null,explode:0,targetExplode:0,shell:false,isolate:false,guide:null,step:0,view:'home',photoURL:null,answers:{},scope:'machine',relatedMode:'faults',pulseStart:0,dragMode:'rotate',cameraTouched:false};
let renderer,scene,camera,controls,root,parts,details={},catalog,cameraGoal=null,targetGoal=null,needsRender=true,lastTime=0;
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),box3=new THREE.Box3();
let pointerDown=null,hiddenPage=false,floor;const activePointers=new Set();

function init(){
 setupContent();
 scene=new THREE.Scene();
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'default'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.8));
 renderer.setClearColor(0xffffff,0);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 wrap.append(renderer.domElement);
 renderer.domElement.setAttribute('aria-label','ドラッグで回転できる'+(isSKP?'SKP-101W':'トラクター')+'。部品は一覧からも選択できます。');
 renderer.domElement.setAttribute('role','img');
 camera=new THREE.PerspectiveCamera(34,1,.001,100);
 controls=new OrbitControls(camera,renderer.domElement);
 configureInspectionControls(controls,isSKP);
 controls.autoRotateSpeed=.65;
 controls.addEventListener('start',()=>{cameraGoal=null;targetGoal=null;state.cameraTouched=true;state.view='free';controls.autoRotate=false;$('rotate-toggle').setAttribute('aria-pressed','false');needsRender=true;});
 controls.addEventListener('change',()=>needsRender=true);
 scene.add(new THREE.HemisphereLight(0xf4f7ff,0x929797,1.8));
 const key=new THREE.DirectionalLight(0xfff7ed,3.4);key.position.set(4,7,4);key.castShadow=true;
 key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=6;key.shadow.camera.bottom=-6;key.shadow.bias=-.0007;key.shadow.normalBias=.025;key.shadow.radius=4;scene.add(key);
 const fill=new THREE.DirectionalLight(0xe3edff,2.1);fill.position.set(-4,3,-4);scene.add(fill);
 const rim=new THREE.DirectionalLight(0xffffff,1.3);rim.position.set(-2,5,4);scene.add(rim);
 floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.12,depthWrite:false}));floor.rotation.x=-Math.PI/2;floor.position.y=-.005;floor.receiveShadow=true;scene.add(floor);
 ({root,parts,details={}}=isSKP?createSKP():createTractor());scene.add(root);catalog=createCatalog(PARTS,details,isSKP?'SKP-101W':'汎用トラクター');
 root.traverse(o=>{if(o.isMesh)o.material.userData.originalColor=o.material.color.clone();});
 buildList();renderExplorer();applyAppearance();createConnectorLines();resize();home(true);
 renderer.domElement.addEventListener('pointerdown',e=>{activePointers.add(e.pointerId);if(activePointers.size===1&&(e.pointerType==='touch'||e.button===0)&&state.dragMode==='rotate')pointerDown={x:e.clientX,y:e.clientY,time:performance.now()};else pointerDown=null;});
 renderer.domElement.addEventListener('pointerup',e=>{activePointers.delete(e.pointerId);if(pointerDown&&activePointers.size===0){const moved=Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y);if(moved<6&&performance.now()-pointerDown.time<600)pick(e);}pointerDown=null;});
 renderer.domElement.addEventListener('pointercancel',e=>{activePointers.delete(e.pointerId);pointerDown=null;});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('load-state').hidden=false;$('load-state').textContent='3D表示が中断しました。ページを再読み込みしてください。';});
 new ResizeObserver(resize).observe(wrap);
 document.addEventListener('visibilitychange',()=>{hiddenPage=document.hidden;needsRender=true;});
 $('load-state').hidden=true;
 bindUI();requestAnimationFrame(frame);
}

let connectorLines;
function createConnectorLines(){
 const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.BufferAttribute(new Float32Array(PARTS.length*6),3));
 const mat=new THREE.LineBasicMaterial({color:0x7b8c9a,transparent:true,opacity:.17,depthWrite:false});
 connectorLines=new THREE.LineSegments(geom,mat);connectorLines.visible=false;scene.add(connectorLines);
}
function updateConnectors(){
 connectorLines.visible=state.explode>.2&&!state.isolate&&!!state.guide;
 if(!connectorLines.visible)return;
 const a=connectorLines.geometry.attributes.position.array;
 PARTS.forEach((p,i)=>{const g=parts[p.id],b=g.userData.base;for(let j=0;j<3;j++){a[i*6+j]=b[j];a[i*6+3+j]=g.position.getComponent(j);}});
 connectorLines.geometry.attributes.position.needsUpdate=true;connectorLines.geometry.computeBoundingSphere();
}
function resize(){
 if(!renderer)return;const {width,height}=wrap.getBoundingClientRect();if(!width||!height)return;
 renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();
 needsRender=true;
}
function bounds(target){root.updateMatrixWorld(true);const b=new THREE.Box3();for(const g of Array.isArray(target)?target:[target]){g.traverseVisible(o=>{if(!o.isMesh)return;if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});}return b;}
function targetFor(id){if(id==='machine')return root;const node=catalog.nodes.get(id);if(!node)return root;if(node.kind==='system')return catalog.partIds(id).map(key=>parts[key]);return details[id]||parts[id];}
function viewTarget(){return state.guide?root:state.isolate&&state.selected?targetFor(state.selected):targetFor(state.scope);}
function layout(amount){positionAssembly(parts,details,catalog,{...state,explode:amount});}

function fit(target,instant=false){
 const b=bounds(target);if(b.isEmpty())return;const center=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3());
 const views={home:[1,.40,1.12],front:[1,.05,0],back:[-1,.05,0],left:[0,.05,-1],right:[0,.05,1],top:[.001,1,.001],bottom:[.001,-1,.001]};
 const dir=(state.view==='free'?camera.position.clone().sub(controls.target):new THREE.Vector3(...(views[state.view]||views.home))).normalize();
 const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),dir).normalize();
 const up=new THREE.Vector3().crossVectors(dir,right).normalize();
 let width=0,height=0,depth=0;
 for(let x of [-1,1])for(let y of [-1,1])for(let z of [-1,1]){const p=new THREE.Vector3(size.x*x/2,size.y*y/2,size.z*z/2);width=Math.max(width,Math.abs(p.dot(right)));height=Math.max(height,Math.abs(p.dot(up)));depth=Math.max(depth,Math.abs(p.dot(dir)));}
 const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
 const distance=Math.max(height/tan,width/(tan*camera.aspect))*(target===root?1.05:1.24)+depth*.65;
 const pos=center.clone().addScaledVector(dir,Math.max(distance,isSKP?.04:.2));
 if(instant||reduced){camera.position.copy(pos);controls.target.copy(center);cameraGoal=null;targetGoal=null;controls.update();}else{cameraGoal=pos;targetGoal=center;}
 needsRender=true;
}
function home(instant=false){state.view='home';state.cameraTouched=false;fit(viewTarget(),instant);}
function setExplode(value,refit=true){
 state.targetExplode=THREE.MathUtils.clamp(value,0,1);
 $('explode').value=Math.round(state.targetExplode*100);$('explode-value').innerHTML=Math.round(state.targetExplode*100)+'<span>%</span>';
 if(refit&&!state.cameraTouched){layout(state.targetExplode);fit(viewTarget());layout(state.explode);}
 needsRender=true;
}
function selectedMesh(o){
 if(!state.selected)return false;
 const n=catalog.nodes.get(state.selected);return n.kind==='part'?catalog.descendants(n.id).includes(o.userData.detailId):catalog.relatedParts(n.id).includes(o.userData.partId);
}
function applyAppearance(){
 const allowed=state.guide?PARTS.map(p=>p.id):catalog.relatedParts(state.scope);
 const selectedParts=state.selected?catalog.relatedParts(state.selected):[];
 for(const p of PARTS){const g=parts[p.id];g.visible=allowed.includes(p.id)&&(!state.isolate||selectedParts.includes(p.id));if(p.exampleOnly&&!state.guide&&state.selected!==p.id&&state.scope!==p.id)g.visible=false;
  g.traverse(o=>{if(!o.isMesh)return;const m=o.material,chosen=selectedMesh(o);const inScope=!!state.guide||catalog.nodes.get(state.scope)?.kind!=='part'||catalog.descendants(state.scope).includes(o.userData.detailId);o.visible=inScope&&(!(state.isolate&&catalog.nodes.get(state.selected)?.kind==='part')||chosen);
   const transparent=state.shell&&!state.isolate&&!chosen&&(p.shell||p.id==='airbox');
   if(m.transparent!==transparent)m.needsUpdate=true;
   m.transparent=transparent;m.opacity=transparent?.13:1;m.depthWrite=!transparent;
   m.color.copy(m.userData.originalColor);m.emissive.setHex(0);m.emissiveIntensity=0;
   if(chosen){m.color.setHex(0xcf2434);m.emissive.setHex(0xad0718);m.emissiveIntensity=.23;}
   o.castShadow=!transparent;
  });
 }
 $('shell-toggle').setAttribute('aria-pressed',String(state.shell));$('shell-toggle').textContent=state.shell?'外装を戻す':'外装を透過';
 $('isolate-part').setAttribute('aria-pressed',String(state.isolate));$('isolate-part').textContent=state.isolate?'周囲も見る':'選択だけ見る';needsRender=true;
}
function pulse(time){
 if(!state.pulseStart)return false;
 const elapsed=time-state.pulseStart,done=elapsed>=2200;
 // Two slow pulses, then steady red; reduced motion uses steady red immediately.
 const strength=done||reduced?1:.55+.45*(.5+.5*Math.cos(elapsed/1100*Math.PI*2));
 for(const g of Object.values(parts))if(g.visible)g.traverse(o=>{if(o.isMesh&&selectedMesh(o)){o.material.color.copy(o.material.userData.originalColor).lerp(new THREE.Color(0xcf2434),strength);o.material.emissiveIntensity=.23*strength;}});
 if(done||reduced)state.pulseStart=0;return true;
}
function select(id,{switchTab=false,focus=false,fromGuide=false}={}){
 const node=catalog.nodes.get(id);if(!node||id==='machine')return;
 if(!fromGuide){state.guide=null;$('guide').hidden=true;}
 if(!fromGuide&&node.parent!==state.scope){state.scope=node.parent;state.isolate=false;state.explode=0;state.targetExplode=0;}
 state.selected=id;state.pulseStart=node.kind==='part'||reduced?0:performance.now();
 if(switchTab)showTab('parts');
 if(node.reveal){state.shell=true;}
 layout(state.explode);applyAppearance();renderExplorer();
 if(focus||state.isolate)fit(targetFor(id));
}
function enterScope(id){
 const node=catalog.nodes.get(id);if(!node||!node.children.length)return;
 state.scope=id;state.cameraTouched=false;state.selected=null;state.isolate=false;state.shell=false;state.guide=null;state.pulseStart=0;$('guide').hidden=true;
 state.explode=0;state.targetExplode=0;layout(0);applyAppearance();renderExplorer();showTab('parts');setExplode(id==='machine'?0:.72);$('part-list').querySelector('button')?.focus({preventScroll:true});if(window.innerWidth<=760)document.querySelector('.inspector').scrollIntoView({block:'start',behavior:reduced?'auto':'smooth'});
}
function pick(e){const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
 const meshes=[];for(const g of Object.values(parts))if(g.visible)g.traverseVisible(o=>{if(o.isMesh&&o.material.opacity>.2)meshes.push(o);});
 const hit=raycaster.intersectObjects(meshes,false)[0];if(!hit)return;
 const id=state.guide?hit.object.userData.partId:catalog.hit(state.scope,hit.object.userData.partId,hit.object.userData.detailId);
 if(id)select(id,{switchTab:true});
}
function buildList(){
 const list=$('part-list'),focused=document.activeElement?.dataset?.part;list.replaceChildren();const scope=catalog.nodes.get(state.scope);
 for(const id of scope.children){const p=catalog.nodes.get(id),b=document.createElement('button');b.className='part-row';b.dataset.part=id;b.setAttribute('aria-pressed',String(state.selected===id));
 const no=document.createElement('span');no.className='number';no.textContent=p.number||String(scope.children.indexOf(id)+1).padStart(2,'0');
 const name=document.createElement('span');name.textContent=p.name;const count=document.createElement('span');count.className='row-plus';count.textContent=p.children.length?'›':'';b.append(no,name,count);b.addEventListener('click',()=>select(id,{switchTab:true}));list.append(b);}
 if(focused)list.querySelector('[data-part="'+focused+'"]')?.focus({preventScroll:true});
 $('parts-count').textContent=scope.children.length+'項目';$('list-title').textContent=scope.kind==='machine'?'部品群':scope.kind==='system'?'構成する部品':'内部の部品';
}
function renderExplorer(){
 const node=catalog.nodes.get(state.selected||state.scope),scope=catalog.nodes.get(state.scope);
 $('detail-index').textContent=state.selected?'選択中 · '+(node.kind==='system'?'部品群':node.kind==='part'?'内部部品':'構成部品'):'現在の表示';
 $('detail-index').classList.toggle('is-selected',!!state.selected);$('detail-name').textContent=node.name;
 $('detail-description').textContent=node.description||initialDescription;
 $('part-manual').hidden=!isSKP||!node.page;if(isSKP&&node.page){$('part-manual').href=SKPData.pageLink(node.page);$('part-manual').textContent='説明書 p.'+node.page+' ↗';}
 $('selected-actions').hidden=!state.selected;$('part-fact').hidden=!node.fact;$('part-fact').textContent=node.fact||'';
 $('drill-part').hidden=!state.selected||!node.children.length;$('drill-part').textContent='内部を見る · '+node.children.length+'項目';
 $('detail-limit').hidden=!((node.kind==='assembly'||node.kind==='part')&&!node.children.length);$('detail-limit').textContent='これより細かな部品は、資料を確認できていないため未モデル化です。';
 const crumbs=$('assembly-path');crumbs.replaceChildren();catalog.path(state.scope).forEach((id,i)=>{if(i){const sep=document.createElement('span');sep.textContent='›';sep.setAttribute('aria-hidden','true');crumbs.append(sep);}const b=document.createElement('button');b.textContent=catalog.nodes.get(id).name;b.addEventListener('click',()=>enterScope(id));if(id===state.scope)b.setAttribute('aria-current','location');crumbs.append(b);});
 $('back-level').hidden=state.scope==='machine';$('explode-label').textContent=scope.kind==='machine'?'部品群を分ける':scope.kind==='system'?'構成部品を分ける':'内部を分ける';
 $('explode').value=Math.round(state.targetExplode*100);$('explode-value').innerHTML=Math.round(state.targetExplode*100)+'<span>%</span>';
 if(state.selected){$('tag-number').textContent='選択中';$('tag-name').textContent=node.name;}else $('part-tag').hidden=true;
 buildList();renderRelated();
}
function renderRelated(){
 const active=state.selected||state.scope;const node=catalog.nodes.get(active);const ids=catalog.relatedParts(active);
 const faults=isSKP?FAULTS.filter(f=>f.parts.some(id=>ids.includes(id))):[];
 $('related-panel').hidden=!isSKP||active==='machine';
 $('related-note').textContent=node.kind==='part'?'親の部品に関連する情報です。この個別部品の故障を示すものではありません。':'説明書に記載された確認候補です。発生頻度は未確認です。';
 const buttons=document.querySelectorAll('[data-related-mode]');buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.relatedMode===state.relatedMode)));
 const list=$('related-list');list.replaceChildren();
 if(!faults.length){const p=document.createElement('p');p.className='empty-related';p.textContent='この部品に関連する不具合・症状は未登録です。';list.append(p);return;}
 const rows=state.relatedMode==='symptoms'?[...new Set(faults.map(f=>f.symptom))].map(symptom=>({label:symptom,conditions:faults.filter(f=>f.symptom===symptom)})):faults.map(f=>({label:f.name,conditions:[f]}));
 for(const row of rows){const item=document.createElement('details'),summary=document.createElement('summary');summary.textContent=row.label;item.append(summary);for(const fault of row.conditions){const description=document.createElement('p');description.textContent=(state.relatedMode==='symptoms'?fault.name+'：':'')+fault.text;item.append(description);
 const source=document.createElement('a');source.href=fault.source;source.target='_blank';source.rel='noopener';source.textContent='説明書 p.'+fault.page+' ↗';item.append(source);
 const locate=document.createElement('button');locate.textContent='3Dで確認箇所を見る';locate.addEventListener('click',()=>{select(fault.focus,{switchTab:true});setExplode(.75);fit(viewTarget());});item.append(locate);
 if(fault.guide){const guide=document.createElement('button');guide.textContent='症状の確認を始める';guide.addEventListener('click',()=>{showTab('symptoms');showGuide(fault.guide);});item.append(guide);}}list.append(item);}
}
function showTab(tab){if(tab==='parts'&&state.guide){state.guide=null;state.scope='machine';state.selected=null;state.isolate=false;state.explode=0;state.targetExplode=0;layout(0);applyAppearance();renderExplorer();home();}document.body.dataset.panel=tab;for(const id of ['parts','symptoms']){$('tab-'+id).setAttribute('aria-selected',String(tab===id));$(id+'-panel').hidden=tab!==id;}}
function showGuide(key,index=0){state.guide=key;state.step=index;state.isolate=false;const guide=GUIDES[key],step=guide.steps[index];
 $('guide').hidden=false;$('step-count').textContent=`${index+1} / ${guide.steps.length}`;
 $('step-title').textContent=step.title;$('step-text').textContent=step.text;
 $('step-prev').disabled=index===0;$('step-next').textContent=index===guide.steps.length-1?'最初に戻る':'次へ';
 $('step-dots').replaceChildren(...guide.steps.map((_,i)=>{const d=document.createElement('i');if(i===index)d.className='active';return d;}));
 $('guide-source').href=step.source||guide.source;
 $('guide-source').textContent=isSKP?'根拠：説明書 p.'+step.page+' ↗':'メーカーの点検資料 ↗';
 for(const b of document.querySelectorAll('[data-symptom]'))b.setAttribute('aria-pressed',String(b.dataset.symptom===key));
 state.shell=!!step.shell;if(step.part)select(step.part,{fromGuide:true});else clearSelection();
 applyAppearance();setExplode(step.explode);controls.autoRotate=false;$('rotate-toggle').setAttribute('aria-pressed','false');
 renderQuestion();renderNotes();
}
function clearSelection(){state.selected=null;state.pulseStart=0;state.isolate=false;$('selected-actions').hidden=true;$('part-fact').hidden=true;$('part-tag').hidden=true;
 $('detail-index').textContent='ASSEMBLY OVERVIEW';$('detail-name').textContent=isSKP?'部品から、説明書へ。':'中の仕組みを、ひとつずつ。';$('detail-description').textContent=initialDescription;$('part-manual').hidden=true;
 document.querySelectorAll('.part-row').forEach(b=>b.setAttribute('aria-pressed','false'));renderExplorer();
}
function reset(){state.dragMode='rotate';setInspectionDragMode(controls,false);$('drag-mode').setAttribute('aria-pressed','false');$('drag-mode').textContent='移動する';$('camera-note').textContent='1本指で回転 · 2本指で移動・拡大';$('view-preset').value='home';state.shell=false;state.isolate=false;state.guide=null;state.scope='machine';state.view='home';state.cameraTouched=false;controls.autoRotate=false;clearSelection();layout(0);applyAppearance();setExplode(0);home();$('rotate-toggle').setAttribute('aria-pressed','false');$('guide').hidden=true;document.querySelectorAll('[data-symptom]').forEach(b=>b.setAttribute('aria-pressed','false'));}
function bindUI(){
 $('drill-part').addEventListener('click',()=>{if(state.selected)enterScope(state.selected);});
 $('back-level').addEventListener('click',()=>enterScope(catalog.nodes.get(state.scope).parent));
 document.querySelectorAll('[data-related-mode]').forEach(b=>b.addEventListener('click',()=>{state.relatedMode=b.dataset.relatedMode;renderRelated();}));

 $('explode').addEventListener('input',e=>setExplode(Number(e.target.value)/100));
 $('shell-toggle').addEventListener('click',()=>{state.shell=!state.shell;applyAppearance();});
 $('rotate-toggle').addEventListener('click',()=>{controls.autoRotate=!controls.autoRotate;$('rotate-toggle').setAttribute('aria-pressed',String(controls.autoRotate));needsRender=true;});
 $('reset').addEventListener('click',reset);
 $('view-preset').addEventListener('change',e=>{state.view=e.target.value==='fit'?'free':e.target.value;state.cameraTouched=false;fit(viewTarget());});
 $('drag-mode').addEventListener('click',()=>{state.dragMode=state.dragMode==='rotate'?'pan':'rotate';const pan=state.dragMode==='pan';setInspectionDragMode(controls,pan);$('drag-mode').setAttribute('aria-pressed',String(pan));$('drag-mode').textContent=pan?'回転に戻す':'移動する';$('camera-note').textContent=pan?'1本指で平行移動 · ピンチで拡大':'1本指で回転 · 2本指で移動・拡大';});
 for(const [id,scale] of [['zoom-in',.9],['zoom-out',1.11]])$(id).addEventListener('click',()=>{const d=camera.position.clone().sub(controls.target);const length=THREE.MathUtils.clamp(d.length()*scale,controls.minDistance,controls.maxDistance);cameraGoal=controls.target.clone().add(d.setLength(length));targetGoal=controls.target.clone();needsRender=true;});
 $('focus-part').addEventListener('click',()=>{if(!state.selected)return;state.dragMode='rotate';setInspectionDragMode(controls,false);$('drag-mode').setAttribute('aria-pressed','false');$('drag-mode').textContent='移動する';state.view='free';state.cameraTouched=false;fit(targetFor(state.selected));$('camera-note').textContent='選択した部品を中心に回転します。';});
 $('isolate-part').addEventListener('click',()=>{if(!state.selected)return;state.isolate=!state.isolate;applyAppearance();fit(viewTarget());});
 ['parts','symptoms'].forEach(id=>$('tab-'+id).addEventListener('click',()=>showTab(id)));
 document.querySelectorAll('[role=tab]').forEach(tab=>tab.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'parts':e.key==='End'?'symptoms':tab.id==='tab-parts'?'symptoms':'parts';showTab(next);$('tab-'+next).focus();}}));
 document.querySelectorAll('[data-symptom]').forEach(b=>b.addEventListener('click',()=>showGuide(b.dataset.symptom)));
 $('model-select').addEventListener('change',e=>{const url=new URL(location.href);url.searchParams.set('model',e.target.value);location.href=url.href;});
 document.querySelectorAll('[data-answer]').forEach(b=>b.addEventListener('click',()=>{if(!state.guide)return;state.answers[state.guide+':'+state.step]=b.dataset.answer;renderQuestion();renderNotes();}));
 $('copy-note').addEventListener('click',async()=>{const report=notesText();try{await navigator.clipboard.writeText(report);$('copy-status').textContent='コピーしました';}catch{const blob=new Blob([report],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='skp-101w-inspection.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('copy-status').textContent='メモを保存しました';}});
 $('step-prev').addEventListener('click',()=>{if(state.guide&&state.step>0)showGuide(state.guide,state.step-1);});
 $('step-next').addEventListener('click',()=>{if(state.guide)showGuide(state.guide,(state.step+1)%GUIDES[state.guide].steps.length);});
 $('photo-input').addEventListener('change',e=>{
  const file=e.target.files?.[0];if(!file)return;
  if(file.size>20*1024*1024){$('photo-status').textContent='20MB以下の写真を選んでください。';return;}
  if(!file.type.startsWith('image/')){$('photo-status').textContent='画像ファイルを選んでください。';return;}
  if(state.photoURL)URL.revokeObjectURL(state.photoURL);state.photoURL=URL.createObjectURL(file);
  const img=$('photo-image');img.onload=()=>{$('photo-preview').hidden=false;$('photo-status').textContent='写真を表示しました。自動診断は行っていません。上の症状を選ぶと、点検候補を表示できます。写真は外部へ送信されません。';};
  img.onerror=()=>{$('photo-preview').hidden=true;$('photo-status').textContent='この画像形式を表示できません。JPEGまたはPNGで選び直してください。';};img.src=state.photoURL;
 });
 $('remove-photo').addEventListener('click',()=>{if(state.photoURL)URL.revokeObjectURL(state.photoURL);state.photoURL=null;$('photo-image').removeAttribute('src');$('photo-input').value='';$('photo-preview').hidden=true;$('photo-status').textContent='写真はこの画面で参照できます。画像の自動診断は未搭載です。';});
}
function tagPosition(){const tag=$('part-tag');if(!state.selected){tag.hidden=true;return;}const g=targetFor(state.selected);if(!g){tag.hidden=true;return;}
 const b=bounds(g);if(b.isEmpty()){tag.hidden=true;return;}const p=b.getCenter(new THREE.Vector3());p.y=b.max.y+.10;p.project(camera);
 const rect=wrap.getBoundingClientRect(),left=wrap.offsetLeft,top=wrap.offsetTop;
 const x=(p.x*.5+.5)*rect.width+left,y=(-p.y*.5+.5)*rect.height+top;
 const maxX=document.querySelector('.viewer').clientWidth-95;
 tag.hidden=p.z>1||y<0||y>top+rect.height;
 tag.style.left=Math.min(Math.max(x,95),maxX)+'px';tag.style.top=y+'px';
}
function frame(time){requestAnimationFrame(frame);if(hiddenPage)return;
 const delta=Math.min((time-lastTime)/1000,.05);lastTime=time;let moving=false;
 if(Math.abs(state.explode-state.targetExplode)>.0008){state.explode=reduced?state.targetExplode:THREE.MathUtils.damp(state.explode,state.targetExplode,9,delta);layout(state.explode);moving=true;}else if(state.explode!==state.targetExplode){state.explode=state.targetExplode;layout(state.explode);moving=true;}
 if(cameraGoal){const t=reduced?1:1-Math.exp(-8*delta);camera.position.lerp(cameraGoal,t);controls.target.lerp(targetGoal,t);moving=true;if(camera.position.distanceTo(cameraGoal)<.003){camera.position.copy(cameraGoal);controls.target.copy(targetGoal);cameraGoal=null;targetGoal=null;}}
 controls.update(delta);if(pulse(time))moving=true;
 if(moving||needsRender||controls.autoRotate){floor.visible=camera.position.y>0;updateConnectors();root.updateMatrixWorld(true);tagPosition();renderer.render(scene,camera);needsRender=false;}
}
function setupContent(){
 document.body.dataset.machine=isSKP?'skp':'tractor';document.body.dataset.panel='parts';
 $('model-select').value=isSKP?'skp':'tractor';
 if(!isSKP){$('model-kicker').textContent='GENERIC / OPEN STATION';$('model-title').textContent='汎用トラクター';$('model-subtitle').textContent='26ユニットの構造モデル';$('model-note').textContent='型式未指定';document.title='汎用トラクター — PARTS LAB';$('download-link').href='./tractor-model.glb';$('download-link').download='tractor-model.glb';$('symptom-description').textContent='症状に関連する点検候補を3Dで表示します。故障の断定はできません。';}
 $('detail-name').textContent=isSKP?'部品から、説明書へ。':'中の仕組みを、ひとつずつ。';$('detail-description').textContent=initialDescription;
 const container=$('symptom-options'),fallback={power:['出力が落ちた','吸気系を見る'],heat:['水温が上がる','冷却系を見る'],start:['始動しにくい','電装系を見る']};
 for(const [key,guide] of Object.entries(GUIDES)){const b=document.createElement('button');b.dataset.symptom=key;b.setAttribute('aria-pressed','false');b.append(document.createTextNode(guide.label||fallback[key][0]));const hint=document.createElement('span');hint.textContent=guide.hint||fallback[key][1];b.append(hint);container.append(b);}
 const source=$('source-details');source.replaceChildren();
 const paragraph=text=>{const p=document.createElement('p');p.textContent=text;source.append(p);};
 const link=(url,label)=>{const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.textContent=label+' ↗';source.append(a);};
 if(isSKP){
  paragraph('外形の目安：'+SKPData.META.dimensionsLabel+'。全体の外形を公表諸元に合わせています。個々の部品寸法・隠れた機構・分解順序は模式表現です。');
  paragraph('共通説明書の機体図はSKP-101表記のため、W仕様の製品写真も参照しています。製造番号・年式との一致は未確認です。図中の番号はこの試作の選択用番号です。');
  link(SKPData.PRODUCT,'SKP-101W 製品情報');link(SKPData.NOTICE,'説明書 PH136-9151-5');link(SKPData.SPECS,'主要諸元');link(SKPData.CATALOG,'製品カタログ（2024年9月作成）');
  paragraph('内部の細分化は複数の部品・締結セットに対応。部品の分割・名称・締結部品も模式表現を含みます。正確な部品番号、本数、寸法、分解順序は未検証です。');
  paragraph('確認メモは回答を記録したもので、故障の確定診断や故障率を示しません。写真の自動診断は未搭載です。');
 }else{paragraph('配置と形状は構造理解用の模式表現です。実機の寸法、配管、分解順序、締付トルクは再現していません。');link(TractorData.SOURCE_ROOT,'トラクタのセルフメンテナンス');}
 paragraph('資料確認：2026年9月9日。'+(isSKP?'カタログ写真から外観を近似したモデルです。隠れた形状の完全再現はできません。':'型式を特定していない構造モデルです。')+'3D形状と画面は独自作成・メーカー非監修。実機作業は該当する説明書を確認してください。');
}
const answerLabels={yes:'ある',no:'見える範囲では見当たらない',unknown:'未確認'};
function renderQuestion(){
 const step=state.guide?GUIDES[state.guide].steps[state.step]:null;
 $('guide-question').hidden=!step?.question;if(!step?.question)return;
 $('question-text').textContent=step.question;const answer=state.answers[state.guide+':'+state.step];
 document.querySelectorAll('[data-answer]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.answer===answer)));
 $('answer-note').textContent=answer==='yes'?step.yes+'。原因はまだ確定していません。':answer==='no'?'見える範囲での確認として記録します。ほかの候補も確認してください。':answer==='unknown'?'未確認として記録します。':'確認できる範囲で選んでください。';
}
function renderNotes(){
 $('inspection-note').hidden=!isSKP||!state.guide;if(!isSKP||!state.guide)return;
 const results=$('inspection-results');results.replaceChildren();
 GUIDES[state.guide].steps.forEach((step,i)=>{if(!step.question)return;const answer=state.answers[state.guide+':'+i]||'unknown';const p=document.createElement('p');const name=document.createElement('strong');name.textContent=step.title+'：';p.append(name,document.createTextNode(answerLabels[answer]));if(answer==='yes'){const hint=document.createElement('span');hint.textContent=step.yes;p.append(hint);}results.append(p);});
 $('copy-status').textContent='';
}
function notesText(){
 const guide=GUIDES[state.guide];if(!guide)return '症状を選択してください。';
 const lines=['SKP-101W 確認メモ','年式・製造番号：未照合','症状：'+guide.label,'記録時刻：'+new Date().toISOString(),''];
 guide.steps.forEach((step,i)=>{if(!step.question)return;const answer=state.answers[state.guide+':'+i]||'unknown';lines.push(step.title+'：'+answerLabels[answer]);if(answer==='yes')lines.push('確認候補：'+step.yes);lines.push('参照：説明書 p.'+step.page+' '+step.source);});
 lines.push('','写真参照：'+(state.photoURL?'あり（写真データはメモに含みません）':'なし'),'原因は未確定。自己回答の記録です。','資料：'+SKPData.META.manualCode+' / 確認日 2026-09-09');return lines.join('\n');
}
try{init();}catch(error){console.error(error);$('load-state').hidden=false;$('load-state').textContent='3D表示を開始できませんでした。SafariまたはChromeで開き直してください。';}
