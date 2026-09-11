import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {makeModel as original} from '../baseline/model.mjs';import {makeModel,measure} from '../src/model.mjs';
import {createAssembly} from '../src/assembly.mjs';import {GeometryPool} from '../src/geometry.mjs';
import {Catalog,canonical,refOf} from '../src/catalog.mjs';import {validateLoft,loftDimensions,makeArchedGeometry} from '../src/arched-loft.mjs';
import {cowlingRecipe,makeCowlingVariant,COWLING_SLOT} from '../src/cowling-recipes.mjs';
import {ExteriorWorkspace,CowlingBridge,WORKSPACE_KEY} from '../src/cowling-bridge.mjs';
const variant=()=>makeCowlingVariant(cowlingRecipe(),{length:340,width:270,height:125,crown:1.1},'variant-1');
const arrays=g=>({positions:[...g.attributes.position.array],indices:g.index?[...g.index.array]:null,normals:[...g.attributes.normal.array]});
function finishModel(m){const gs=new Set(),ms=new Set();m.root.traverse(o=>{if(o.isMesh){gs.add(o.geometry);ms.add(o.material);}});gs.forEach(g=>g.dispose());ms.forEach(x=>x.dispose());}
function partDigest(a){return [...a.parts].map(([id,p])=>({id,revision:p.revision,geometry:arrays(p.mesh.geometry),home:p.home}));}

test('C1 all 174 original meshes remain byte-identical after moving cowling to a recipe',()=>{
 const a=original(),b=makeModel();try{const old=[],now=[];for(const[m,list]of[[a,old],[b,now]])m.root.traverse(o=>{if(o.isMesh)list.push({name:o.name,shape:arrays(o.geometry),position:o.position.toArray(),quaternion:o.quaternion.toArray()});});assert.equal(old.length,174);assert.deepEqual(now,old);assert.deepEqual(measure(a.root),measure(b.root));}finally{finishModel(a);finishModel(b);}
});
test('C2 same loft generator reproduces three old curved covers from local-frame sections',()=>{
 const model=original();try{for(const name of['orange-cowling','under-cowling','orange-pivot-console']){
  const old=model.root.getObjectByName(name).geometry,v=old.attributes.position.array,steps=20,sections=[];
  // Only a migration test: recover the existing authored cross-section samples.
  for(let i=0;i<v.length;i+=(steps+1)*3)sections.push([v[i],v[i+20*3+1],v[i+10*3+1],v[i+2]]);
  const anchor=[sections[0][0],Math.min(...sections.map(s=>s[1])),0],local=sections.map(([x,b,t,w])=>[x-anchor[0],b-anchor[1],t-anchor[1],w]);
  const g=makeArchedGeometry({steps,sections:local},anchor);try{assert.deepEqual(arrays(g),arrays(old));}finally{g.dispose();}
 }}finally{finishModel(model);}
});
test('C3 one curved definition yields independent placements with one shared geometry',()=>{
 const pool=new GeometryPool();try{const a=pool.acquire(cowlingRecipe(),{instanceId:'A',machineId:'example-A'}),b=pool.acquire(cowlingRecipe(),{instanceId:'B',machineId:'example-B',position:[1000,25,0]});assert.equal(pool.stats.geometryBuilds,1);assert.equal(a.children[0].geometry,b.children[0].geometry);a.children[0].material.color.setHex(0xff0000);assert.notEqual(a.children[0].material.color.getHex(),b.children[0].material.color.getHex());assert.equal(b.position.x,1000);assert.equal(b.userData.fitStatus,'unconfirmed');}finally{pool.dispose();}
});
test('C4 configured dimensions and crown change only recipe data; old revision is immutable',()=>{
 const r=cowlingRecipe(),old=canonical(r),v=variant(),d=loftDimensions(v.params);assert.deepEqual(d,{length:340,width:270,height:125});assert.equal(canonical(r),old);assert.notEqual(v.params.sections[2][2]/125,r.params.sections[2][2]/107);
 const c=new Catalog();c.add(r);const bad=structuredClone(v);bad.revision=r.revision;assert.throws(()=>c.add(bad),/上書き/);c.add(v);assert.equal(Catalog.parse(c.serialize()).serialize(),c.serialize());
});
test('C5 adapter preserves explicit part frame and updates only one mesh, undo is exact',()=>{
 const a=createAssembly(),w=new ExteriorWorkspace(a);try{const old=partDigest(a),home=canonical(a.snapshot().parts.map(p=>({id:p.id,home:p.home}))),offset=canonical([...a.explodeOffsets]);w.apply(refOf(cowlingRecipe()));assert.deepEqual(arrays(a.parts.get(COWLING_SLOT).mesh.geometry),old.find(x=>x.id===COWLING_SLOT).geometry);w.catalog.add(variant());w.apply(refOf(variant()));const changed=partDigest(a).filter((p,i)=>canonical(p.geometry)!==canonical(old[i].geometry));assert.equal(changed.length,1);assert.equal(changed[0].id,COWLING_SLOT);assert.equal(canonical(a.snapshot().parts.map(p=>({id:p.id,home:p.home}))),home);assert.equal(canonical([...a.explodeOffsets]),offset);assert.equal(a.snapshot().documented3dParts,0);a.undo(COWLING_SLOT);assert.deepEqual(arrays(a.parts.get(COWLING_SLOT).mesh.geometry),old.find(x=>x.id===COWLING_SLOT).geometry);assert.equal(w.activeRef,refOf(cowlingRecipe()));}finally{w.dispose();a.dispose();}
});
test('C6 workspace persists recipe and binding; fresh assembly replays the selected shape',()=>{
 const a=createAssembly(),b=createAssembly(),w=new ExteriorWorkspace(a),next=new ExteriorWorkspace(b),values=new Map(),storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)};
 try{w.catalog.add(variant());w.apply(refOf(variant()));assert.equal(w.save(storage).saved,true);assert.equal(next.restore(storage).restored,true);assert.equal(next.serialize(),w.serialize());assert.deepEqual(arrays(b.parts.get(COWLING_SLOT).mesh.geometry),arrays(a.parts.get(COWLING_SLOT).mesh.geometry));assert.equal(next.catalog.list().length,7);assert.equal(values.has(WORKSPACE_KEY),true);assert.equal(next.save({setItem(){throw Error('quota');}}).saved,false);}finally{w.dispose();next.dispose();a.dispose();b.dispose();}
});
test('C7 malformed or conflicting recipes and wrong/outside bindings reject atomically',()=>{
 const a=createAssembly(),w=new ExteriorWorkspace(a);try{w.catalog.add(variant());w.apply(refOf(variant()));const state=w.serialize(),shapes=canonical(partDigest(a)),offset=canonical([...a.explodeOffsets]);
  const mutations=[d=>d.binding.partId='another-machine',d=>d.catalog.assets.find(r=>r.family==='archedLoft').params.sections[1][0]=0,d=>d.catalog.assets[0].verified=true,d=>d.catalog.assets.find(r=>r.family==='archedLoft').label='conflict'];
  for(const f of mutations){const d=JSON.parse(state);f(d);assert.throws(()=>w.import(JSON.stringify(d)));assert.equal(w.serialize(),state);assert.equal(canonical(partDigest(a)),shapes);}
  const d=JSON.parse(state),huge=makeCowlingVariant(cowlingRecipe(),{length:3000,width:270,height:125,crown:1},'huge');d.catalog.assets.push(huge);d.binding.assetRef=refOf(huge);assert.throws(()=>w.import(JSON.stringify(d)),/全体外寸/);assert.equal(w.serialize(),state);assert.equal(canonical(partDigest(a)),shapes);assert.equal(canonical([...a.explodeOffsets]),offset);
 }finally{w.dispose();a.dispose();}
});
test('C8 baseline mismatch and invalid cross-sections never silently fit a replacement',()=>{
 for(const f of[p=>p.sections[0][0]=1,p=>p.steps=3,p=>p.sections[2][3]=0,p=>p.sections[2][2]=NaN,p=>p.extra=true]){const p=cowlingRecipe().params;f(p);assert.throws(()=>validateLoft(p));}
 const a=createAssembly(),bridge=new CowlingBridge(a);try{a.parts.get(COWLING_SLOT).baselineGeometry.attributes.position.array[0]-=1;assert.throws(()=>bridge.packageFor(cowlingRecipe()),/基点/);}finally{bridge.dispose();a.dispose();}
});
test('C9 recipe generation and installed export are deterministic across three independent runs',()=>{
 const sha=[];for(let i=0;i<3;i++){const a=createAssembly(),w=new ExteriorWorkspace(a);try{w.catalog.add(variant());w.apply(refOf(variant()));sha.push(createHash('sha256').update(w.serialize()).update(canonical(arrays(a.parts.get(COWLING_SLOT).mesh.geometry))).digest('hex'));}finally{w.dispose();a.dispose();}}assert.equal(new Set(sha).size,1);
});

test('C10 undo to an earlier library variant preserves that binding across export and reload',()=>{
 const a=createAssembly(),b=createAssembly(),w=new ExteriorWorkspace(a),next=new ExteriorWorkspace(b);
 try{const first=variant(),second=makeCowlingVariant(cowlingRecipe(),{length:320,width:260,height:115,crown:.9},'variant-2');w.catalog.add(first);w.catalog.add(second);w.apply(refOf(first));w.apply(refOf(second));a.undo(COWLING_SLOT);assert.equal(w.activeRef,refOf(first));next.import(w.serialize());assert.equal(next.activeRef,refOf(first));assert.deepEqual(arrays(a.parts.get(COWLING_SLOT).mesh.geometry),arrays(b.parts.get(COWLING_SLOT).mesh.geometry));}finally{w.dispose();next.dispose();a.dispose();b.dispose();}
});
