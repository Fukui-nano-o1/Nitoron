import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {geometryKit} from '../src/skp-geometry.js';
import {createSKP} from '../src/skp-model.js';
import {createSKP as createBaseline} from '../baseline/skp-model.js';
import {createCatalog,positionAssembly} from '../src/assembly-tree.js';
import {PARTS} from '../src/skp-parts.js';
import {AUTHORED_RADII_M,NOMINAL_DIAMETERS_MM,GEOMETRY_TOLERANCE_MM} from '../src/wheel-spec.mjs';
import {measureModel,surfaceRoundness,disposeModel} from '../src/measurement.mjs';

const sha=data=>createHash('sha256').update(data).digest('hex');
const close=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}; tolerance ${tol}`);
const closeArray=(a,b,tol=1e-6)=>{assert.equal(a.length,b.length);a.forEach((x,i)=>close(x,b[i],tol));};
function vertices(object){
 object.updateWorldMatrix(true,true);const out=[],v=new T.Vector3();
 object.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position,index=m.geometry.index;
  for(let i=0;i<(index?index.count:p.count);i++) {v.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(m.matrixWorld);out.push(...v.toArray());}
 });return out;
}
function geometryDigest(object){
 object.updateWorldMatrix(true,true);const h=createHash('sha256');
 object.traverse(o=>{
  h.update(JSON.stringify({name:o.name,position:o.position.toArray(),rotation:o.quaternion.toArray(),scale:o.scale.toArray(),base:o.userData.base,explode:o.userData.explode}));
  if(o.isMesh){h.update(JSON.stringify(o.matrixWorld.elements));for(const key of Object.keys(o.geometry.attributes).sort()){const a=o.geometry.attributes[key].array;h.update(key);h.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}if(o.geometry.index){const a=o.geometry.index.array;h.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}}
 });return h.digest('hex');
}
function fixture(nominal){
 const root=new T.Group(),defs=[{id:'cylinder',category:'test'},{id:'oblique',category:'test'}],k=geometryKit(root,defs);
 const c=k.part('cylinder',[.3,.7,-.5],[.1,.2,.3]);k.cyl(c,.1,.2,[0,0,0],'metal','z',.1,64);
 const p=k.part('oblique',[-.2,.5,.9],[.3,.2,.1]);const d=k.piece(p,'link','Nested angled rod',[.02,.03,.04]);
 const r=k.rod(d,[-.1,-.2,-.3],[.3,.4,.5],.013,'silver');r.rotateY(.23);r.rotateX(.31);
 const before={cylinder:vertices(c),oblique:vertices(p)};const result=k.finish(nominal);
 return {...result,before};
}

test('Baseline four source files match archived SHA-256 and Git blob identities',async()=>{
 const identities=JSON.parse(await readFile(new URL('../baseline/source-identities.json',import.meta.url)));
 assert.equal(identities.main,'76fd603ec1156f8ff9b2a670d7bb6cda0de1a927');
 assert.equal(Object.keys(identities.files).length,4);
 for(const [name,expect]of Object.entries(identities.files)){
  const bytes=await readFile(new URL('../baseline/'+name,import.meta.url));assert.equal(sha(bytes),expect.sha256,name);
  const git=createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');assert.equal(git,expect.gitBlob,name);
 }
});

test('finish preserves a known cylinder and nested oblique rod; nominal envelope cannot alter geometry',()=>{
 const a=fixture([2.2,1.35,1.35]),b=fixture([22,17,31]);
 try{
  for(const id of ['cylinder','oblique']){closeArray(vertices(a.parts[id]),a.before[id]);assert.equal(geometryDigest(a.parts[id]),geometryDigest(b.parts[id]));}
  const box=new T.Box3().setFromObject(a.parts.cylinder,true),size=box.getSize(new T.Vector3());closeArray(size.toArray(),[.2,.2,.2]);
  assert.deepEqual(a.root.userData.metricPolicy.appliedScale,[1,1,1]);
  assert.deepEqual(a.parts.oblique.position.toArray(),[-.2,.5,.9]);
 }finally{disposeModel(a);disposeModel(b);}
});

test('Four wheels meet the explicitly defined circumscribed tread diameter, and smooth bodies remain round',()=>{
 const m=createSKP();
 try{
  m.root.updateMatrixWorld(true);
  for(const id of ['frontL','frontR','rearL','rearR']){
   // Independent vertex calculation, using a fixed authored axle and tyre subtree.
   const axle=m.parts[id].getWorldPosition(new T.Vector3()),v=new T.Vector3();let squared=0;
   m.details[id+'__tire'].traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).sub(axle);squared=Math.max(squared,v.x*v.x+v.y*v.y);}});
   const target=NOMINAL_DIAMETERS_MM[id.startsWith('front')?'front':'rear'];close(2*Math.sqrt(squared)*1000,target,GEOMETRY_TOLERANCE_MM);
   for(const kind of ['tire','rim']){const result=surfaceRoundness(m,id,kind);assert.ok(result.slices>=24);assert.ok(result.maxRadialSpreadMm<.001,`${id}/${kind}: ${result.maxRadialSpreadMm}`);}
  }
 }finally{disposeModel(m);}
});

test('Roundness gate rejects the distorted baseline rather than accepting a diameter-only correction',()=>{
 const b=createBaseline();try{b.root.updateMatrixWorld(true);for(const id of ['frontL','frontR','rearL','rearR'])for(const kind of ['tire','rim'])assert.ok(surfaceRoundness(b,id,kind).maxRadialSpreadMm>1);}finally{disposeModel(b);}
});

test('Wheel recipe edits leave all 29 other assemblies and every authored axle center exactly unchanged',()=>{
 const a=createSKP({wheelBodyRadiiM:AUTHORED_RADII_M}),b=createSKP();
 try{
  const wheels=new Set(['frontL','frontR','rearL','rearR']);let unchanged=0;
  for(const id of Object.keys(a.parts)){
   assert.deepEqual(a.parts[id].position.toArray(),b.parts[id].position.toArray(),id+' fixed position');
   assert.deepEqual(a.parts[id].userData.base,b.parts[id].userData.base,id+' fixed base');
   if(!wheels.has(id)){assert.equal(geometryDigest(a.parts[id]),geometryDigest(b.parts[id]),id);unchanged++;}
  }assert.equal(unchanged,29);
 }finally{disposeModel(a);disposeModel(b);}
});

test('All 33 assemblies and 214 detail identities, parents, and pick hierarchy are preserved',()=>{
 const a=createBaseline(),b=createSKP();try{
  assert.equal(Object.keys(b.parts).length,33);assert.equal(Object.keys(b.details).length,214);
  assert.deepEqual(Object.keys(a.parts).sort(),Object.keys(b.parts).sort());assert.deepEqual(Object.keys(a.details).sort(),Object.keys(b.details).sort());
  const ca=createCatalog(PARTS,a.details),cb=createCatalog(PARTS,b.details);
  for(const id of cb.nodes.keys()){assert.deepEqual(cb.path(id),ca.path(id),id);}
  b.root.traverse(o=>{if(!o.isMesh)return;const {partId,detailId}=o.userData;const path=cb.path(detailId||partId);for(let i=0;i<path.length-1;i++)assert.equal(cb.hit(path[i],partId,detailId),path[i+1]);});
 }finally{disposeModel(a);disposeModel(b);}
});

test('Every expandable hierarchy returns exactly to fixed metric base after explode and guide reset',()=>{
 const m=createSKP();try{
  const catalog=createCatalog(PARTS,m.details),all=[...Object.entries(m.parts),...Object.entries(m.details)];
  const initial=new Map(all.map(([id,g])=>[id,g.position.toArray()]));
  for(const node of catalog.nodes.values()){
   if(!node.children.length)continue;
   positionAssembly(m.parts,m.details,catalog,{scope:node.id,explode:1});
   assert.ok(all.some(([id,g])=>g.position.toArray().some((v,i)=>v!==initial.get(id)[i])),node.id+' expands');
   positionAssembly(m.parts,m.details,catalog,{scope:'machine',explode:0,guide:'inspection'});
   for(const [id,g]of all)assert.deepEqual(g.position.toArray(),initial.get(id),node.id+' -> '+id);
  }
 }finally{disposeModel(m);}
});

test('Measured envelope and ground mismatches remain visible; neither geometry nor evidence claims physical verification',()=>{
 const m=createSKP();try{
  const report=measureModel(m);assert.equal(report.documented3dParts,0);assert.equal(m.root.userData.documented3dParts,0);
  assert.equal(m.root.userData.metricPolicy.productionModelVersion,null);
  assert.deepEqual(report.nominalXYZmm,[2200,1350,1350]);
  assert.ok(report.deltaXYZmm.some(v=>Math.abs(v)>10),'Candidate does not force nominal envelope');
  assert.ok(report.wheels.some(w=>Math.abs(w.lowestYmm)>5),'Actual ground gap is retained');
  for(const w of report.wheels)assert.ok(Number.isFinite(w.lowestYmm));
 }finally{disposeModel(m);}
});

test('Measurement output is deterministic across three independently generated models and matches delivered evidence',async()=>{
 const snapshots=[];
 for(let i=0;i<3;i++){
  const m=createSKP();try{snapshots.push(JSON.stringify(measureModel(m)));}finally{disposeModel(m);}
 }
 assert.equal(sha(snapshots[0]),sha(snapshots[1]));assert.equal(sha(snapshots[1]),sha(snapshots[2]));
 const evidence=JSON.parse(await readFile(new URL('../evidence/measurements.json',import.meta.url)));
 assert.deepEqual(JSON.parse(snapshots[0]),evidence.stages.metricWheels);
 assert.equal(evidence.acceptance.physicalCompatibilityVerified,false);assert.equal(evidence.acceptance.completeCatalogue99Percent,false);
});

test('Non-finite, non-positive and oversized wheel parameters are rejected before model creation',()=>{
 for(const value of [NaN,Infinity,-1,0,.401])for(const kind of ['front','rear'])assert.throws(()=>createSKP({wheelBodyRadiiM:{...AUTHORED_RADII_M,[kind]:value}}),/Invalid wheel body radius/);
});
