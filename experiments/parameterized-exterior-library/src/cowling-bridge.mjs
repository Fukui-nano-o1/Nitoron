import * as T from '../vendor/three.module.js';
import {Catalog,validateRecipe,refOf,canonical} from './catalog.mjs';
import {GeometryPool} from './geometry.mjs';
import {MACHINE} from './part-package.mjs';
import {cowlingRecipe,COWLING_SLOT,COWLING_ANCHOR} from './cowling-recipes.mjs';
import {makeArchedGeometry} from './arched-loft.mjs';
import {EXAMPLES} from './examples.mjs';

export const WORKSPACE_KEY='nitoron:exterior-library:v1';
export function seededCatalog(){const c=new Catalog();for(const r of EXAMPLES)c.add(r);c.add(cowlingRecipe());return c;}
const exactly=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
// This adapter is a single explicitly-bound PC752N slot. No category/name guessing,
// no arbitrary matrices in imported recipes, and no scaling to make a part fit.
export class CowlingBridge{
 #assembly;#pool=new GeometryPool();#seq=0;#baselineChecked=false;
 constructor(assembly){this.#assembly=assembly;}
 #checkBaseline(){
  if(this.#baselineChecked)return;
  const p=this.#assembly.parts.get(COWLING_SLOT);
  if(!p||!exactly(p.home.position,[0,0,0])||!exactly(p.home.quaternion,[0,0,0,1])||!exactly(p.home.scale,[1,1,1]))throw Error('既存カバーの取付座標が一致しません');
  const expected=makeArchedGeometry(cowlingRecipe().params,COWLING_ANCHOR);
  try{if(!exactly([...expected.attributes.position.array],[...p.baselineGeometry.attributes.position.array])||!exactly([...expected.index.array],[...p.baselineGeometry.index.array]))throw Error('既存カバー形状が基点と異なります。自動で上書きしません');}finally{expected.dispose();}
  this.#baselineChecked=true;
 }
 packageFor(input){
  this.#checkBaseline();const r=validateRecipe(input);if(r.family!=='archedLoft')throw Error('この取付先は断面曲面だけに対応しています');
  const instance=this.#pool.acquire(r,{instanceId:'bridge-'+(++this.#seq),machineId:'pc752n'});
  try{
   const m=instance.getObjectByName('arched-shell');
   // Exactly one mesh is expected for THIS family. Multi-mesh parts are not truncated.
   const meshes=[];instance.traverse(o=>{if(o.isMesh)meshes.push(o);});if(meshes.length!==1||!m)throw Error('交換形式に対応しない複数メッシュです');
   const local=m.geometry.userData.precisePositions;
   const positions=Array.from(new Float32Array(local.map((x,i)=>x+COWLING_ANCHOR[i%3])));
   const p=this.#assembly.part(COWLING_SLOT),revision='catalog-'+refOf(r);
   return{schemaVersion:1,machine:{maker:MACHINE.maker,model:MACHINE.model,variant:MACHINE.variant},partId:COWLING_SLOT,fromRevision:p.revision,revision,units:'mm',frame:MACHINE.frame,geometry:{positions,indices:Array.from(m.geometry.index.array)},evidence:{basis:'photo-estimate',sourceRefs:[refOf(r),...r.sources.map(s=>s.reference)].slice(0,12),note:'部品庫の断面曲面を明示した取付座標へ移動。実機適合・寸法の実測照合なし。塗色と表示手順は配置先を維持。'}};
  }finally{this.#pool.release(instance);}
 }
 get stats(){return this.#pool.stats;}
 dispose(){this.#pool.dispose();}
}

export class ExteriorWorkspace{
 #assembly;#bridge;#apply;#catalog;#bindings=new Map();
 constructor(assembly,apply=p=>assembly.applyPackage(p)){this.#assembly=assembly;this.#bridge=new CowlingBridge(assembly);this.#apply=apply;this.#catalog=seededCatalog();}
 get catalog(){return this.#catalog;}
 get activeRef(){const p=this.#assembly.parts.get(COWLING_SLOT),b=this.#bindings.get(p?.revision);return b&&b.geometry===p.mesh.geometry?b.ref:null;}
 get stats(){return this.#bridge.stats;}
 #install(catalog,ref){
  const r=catalog.get(ref);if(r.family!=='archedLoft')throw Error('取付先に使える外装版を選んでください');
  const p=this.#bridge.packageFor(r),current=this.#assembly.parts.get(COWLING_SLOT);
  if(current.revision===p.revision){
   if(!exactly([...current.mesh.geometry.attributes.position.array],p.geometry.positions)||!exactly([...current.mesh.geometry.index.array],p.geometry.indices))throw Error('同じ部品版に異なる形状があります');
  }else this.#apply(p);
  const installed=this.#assembly.parts.get(COWLING_SLOT);
  this.#bindings.set(p.revision,{ref,geometry:installed.mesh.geometry});
  for(const[key,b]of this.#bindings)if(b.geometry!==installed.mesh.geometry&&b.geometry!==installed.previous?.geometry)this.#bindings.delete(key);
 }
 apply(ref){this.#install(this.#catalog,ref);return this.#assembly.part(COWLING_SLOT);}
 serialize(){return canonical({schemaVersion:1,kind:'exterior-library-workspace',catalog:JSON.parse(this.#catalog.serialize()),binding:this.activeRef?{partId:COWLING_SLOT,assetRef:this.activeRef}:null});}
 // Parse, validate catalog/version conflicts, validate target/envelope, then commit.
 // A rejected import never replaces a live catalog or live geometry.
 import(raw){
  if(typeof raw!=='string'||new TextEncoder().encode(raw).length>1024*1024)throw Error('外装データは1MiB以内です');
  let d;try{d=JSON.parse(raw);}catch{throw Error('JSONを読み取れません');}
  if(!d||Array.isArray(d)||Object.keys(d).some(k=>!['schemaVersion','kind','catalog','binding'].includes(k))||d.schemaVersion!==1||d.kind!=='exterior-library-workspace')throw Error('外装データの形式が不正です');
  const next=Catalog.parse(JSON.stringify(d.catalog)),merged=Catalog.parse(this.#catalog.serialize());
  for(const r of next.list())merged.add(r);
  if(d.binding!==null){
   const b=d.binding;if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!['partId','assetRef'].includes(k))||b.partId!==COWLING_SLOT||typeof b.assetRef!=='string')throw Error('取付先が一致しません');
   this.#install(merged,b.assetRef);
  }
  this.#catalog=merged;return{assets:merged.list().length,activeRef:this.activeRef};
 }
 save(storage){try{storage.setItem(WORKSPACE_KEY,this.serialize());return{saved:true};}catch{return{saved:false,message:'端末へ保存できません。JSONを書き出してください。'};}}
 restore(storage){try{const raw=storage.getItem(WORKSPACE_KEY);if(!raw)return{restored:false};this.import(raw);return{restored:true};}catch(e){return{restored:false,error:e.message};}}
 dispose(){this.#bridge.dispose();this.#bindings.clear();}
}
