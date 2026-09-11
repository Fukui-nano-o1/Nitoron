import * as T from '../vendor/three.module.js';
import {makeModel,measure,SPEC} from './model.mjs';
import {MACHINE,validatePackage} from './part-package.mjs';
import {layerFor} from './presentation.mjs';

const failure=(code,message)=>{const e=new Error(message);e.code=code;throw e;};
export function createAssembly(){
 const base=makeModel(),parts=new Map(),legacy=new Map(),occurrences=new Map(),explodeOffsets=new Map();
 const originalBounds=measure(base.root);let legacySequence=0,disposed=false;
 for(const [groupId,g] of Object.entries(base.groups)){
  g.userData.nodeId='group:'+groupId;
  for(const mesh of g.children){
   if(!mesh.isMesh)continue;
   const family=groupId+'/'+mesh.name,n=(occurrences.get(family)||0)+1;occurrences.set(family,n);
   // A scoped immutable slot: unrelated families cannot renumber this part.
   // These baseline slots are never regenerated from imported geometry/order.
   const id='pc752n/'+family+'/'+String(n).padStart(3,'0');
   const old='element-'+String(++legacySequence).padStart(3,'0');
   const home={position:mesh.position.toArray(),quaternion:mesh.quaternion.toArray(),scale:mesh.scale.toArray()};
   const declaredDimensions=mesh.name==='rubber-belt'?[{axis:'width',mm:110,source:'S1'}]:[];
   const evidence={basis:'photo-estimate',sourceRefs:['S1','S3'],note:'公式写真から人手で作成。個別形状・取付位置の実測なし。',reviewStatus:'unverified'};
   mesh.userData={...mesh.userData,partId:id,elementId:id,legacyElementId:old,nodeId:id,layer:layerFor(mesh.name,groupId)};
   const part={id,groupId,name:mesh.name,mesh,home,declaredDimensions,revision:'exterior-v1',evidence,baselineGeometry:mesh.geometry,previous:null};
   parts.set(id,part);legacy.set(old,id);
  }
 }
 // Display-only displacements are captured once, separately from geometry.
 function plan(parent){const b=new T.Box3().setFromObject(parent),c=b.getCenter(new T.Vector3()),span=Math.max(b.getSize(new T.Vector3()).length()*.25,60);parent.children.forEach((p,i)=>{const v=new T.Box3().setFromObject(p).getCenter(new T.Vector3()).sub(c);if(v.length()<20)v.set(Math.cos(i*2.4),.3,Math.sin(i*2.4));v.normalize();v.y+=.35;explodeOffsets.set(p.userData.nodeId,v.multiplyScalar(span*(.65+i%3*.22)).toArray());});}
 plan(base.root);Object.values(base.groups).forEach(plan);
 function metadata(p){return{id:p.id,groupId:p.groupId,name:p.name,revision:p.revision,home:structuredClone(p.home),layer:p.mesh.userData.layer,evidence:structuredClone(p.evidence),declaredDimensions:structuredClone(p.declaredDimensions),modelDimensions:measure(p.mesh),canUndo:Boolean(p.previous)};}
 function part(id){const p=parts.get(id)||parts.get(legacy.get(id));return p?metadata(p):null;}
 function snapshot(){return{schemaVersion:1,machine:{...MACHINE},overallDimensions:measure(base.root),documented3dParts:0,automaticReconstruction:false,parts:[...parts.values()].map(metadata)};}
 function exportPart(id,{fromBaseline=false}={}){const p=parts.get(id);if(!p)failure('unknown-part','部品を選択してください');const g=p.mesh.geometry;return{schemaVersion:1,machine:{maker:MACHINE.maker,model:MACHINE.model,variant:MACHINE.variant},partId:p.id,fromRevision:fromBaseline?'exterior-v1':p.revision,revision:fromBaseline&&p.revision!=='exterior-v1'?p.revision:p.revision+'-next',units:'mm',frame:MACHINE.frame,geometry:{positions:Array.from(g.attributes.position.array),indices:g.index?Array.from(g.index.array):Array.from({length:g.attributes.position.count},(_,i)=>i)},evidence:{basis:p.evidence.basis,sourceRefs:[...p.evidence.sourceRefs],note:p.evidence.note}};}
 function validateGeometry(p,geometry){
  const candidate=base.root.clone(true);let node;candidate.traverse(x=>{if(x.userData.partId===p.id)node=x;});node.geometry=geometry;
  const m=measure(node);for(const d of p.declaredDimensions)if(Math.abs(m[d.axis]-d.mm)>.01)failure('dimension-conflict','公式の確認値 '+d.axis+' '+d.mm+' mm と一致しません');
  const all=measure(candidate);
  for(let i=0;i<3;i++)if(Math.abs(all.min[i]-originalBounds.min[i])>.01||Math.abs(all.max[i]-originalBounds.max[i])>.01)failure('envelope-conflict','組立時の全体外寸・原点が変わります。自動縮尺合わせは行いません');
 }
 function applyPackage(input){
  if(disposed)failure('disposed','終了済みのモデルです');
  const p=parts.get(input?.partId),data=validatePackage(input,p);
  const geometry=new T.BufferGeometry();
  try{
   geometry.setAttribute('position',new T.Float32BufferAttribute(data.geometry.positions,3));geometry.setIndex(data.geometry.indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();validateGeometry(p,geometry);
  }catch(e){geometry.dispose();throw e;}
  const previous=p.previous;
  p.previous={geometry:p.mesh.geometry,revision:p.revision,evidence:p.evidence};
  p.mesh.geometry=geometry;p.revision=data.revision;p.evidence={...data.evidence,reviewStatus:'pending-review'};
  if(previous&&previous.geometry!==p.baselineGeometry)previous.geometry.dispose();
  return part(p.id);
 }
 function undo(id){const p=parts.get(id);if(!p||!p.previous)failure('no-previous','戻せる部品版がありません');const current=p.mesh.geometry,old=p.previous;p.mesh.geometry=old.geometry;p.revision=old.revision;p.evidence=old.evidence;p.previous=null;if(current!==p.baselineGeometry)current.dispose();return part(id);}
 function dispose(){if(disposed)return;disposed=true;const geometries=new Set(),materials=new Set();for(const p of parts.values()){geometries.add(p.mesh.geometry);geometries.add(p.baselineGeometry);if(p.previous)geometries.add(p.previous.geometry);materials.add(p.mesh.material);}geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
 return{...base,parts,part,snapshot,exportPart,applyPackage,undo,dispose,explodeOffsets,spec:SPEC};
}
