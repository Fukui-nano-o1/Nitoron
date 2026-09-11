import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createAssembly} from './src/assembly.mjs';
import {parsePackage} from './src/part-package.mjs';
import {DISPLAY_STEPS} from './src/presentation.mjs';
const id='pc752n/engine/orange-cowling/001';
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/cowling-revision.json',import.meta.url),'utf8'));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function identities(a){return a.snapshot().parts.map(({id,groupId,home,layer})=>({id,groupId,home,layer}));}
function offsets(a){return [...a.explodeOffsets];}
function withAssembly(fn){const a=createAssembly();try{return fn(a);}finally{a.dispose();}}
test('all 174 baseline parts have unique scoped identities and legacy aliases',()=>withAssembly(a=>{
 assert.equal(a.parts.size,174);assert.equal(new Set(a.parts.keys()).size,174);
 for(const p of a.parts.values()){assert.equal(a.part(p.mesh.userData.legacyElementId).id,p.id);assert.equal(p.mesh.userData.nodeId,p.id);}
 assert.equal(a.part(id).name,'orange-cowling');assert.equal(a.part('unknown'),null);
}));
test('real geometry replacement preserves all identities, assembly transforms, offsets and display guide',()=>withAssembly(a=>{
 const before=a.snapshot(),oldGeometry=a.parts.get(id).mesh.geometry,unchanged=identities(a),moves=offsets(a),steps=hash(DISPLAY_STEPS),input=fixture(),original=structuredClone(input);
 const result=a.applyPackage(input);
 assert.equal(oldGeometry.attributes.position.count,126);assert.equal(a.parts.get(id).mesh.geometry.attributes.position.count,246);
 assert.notEqual(a.parts.get(id).mesh.geometry,oldGeometry);assert.deepEqual(input,original);
 assert.deepEqual(identities(a),unchanged);assert.deepEqual(offsets(a),moves);assert.equal(hash(DISPLAY_STEPS),steps);
 assert.deepEqual(a.snapshot().overallDimensions,before.overallDimensions);assert.equal(result.revision,input.revision);
 assert.deepEqual(a.snapshot().parts.filter(p=>p.id!==id),before.parts.filter(p=>p.id!==id));
}));
test('a claimed measured or supplier CAD source remains pending and grants no verification',()=>withAssembly(a=>{
 for(const basis of ['measured','supplier-cad']){const p=fixture();p.evidence.basis=basis;a.applyPackage(p);assert.equal(a.part(id).evidence.reviewStatus,'pending-review');assert.equal(a.snapshot().documented3dParts,0);assert.equal(a.snapshot().automaticReconstruction,false);a.undo(id);}
}));
test('rejected packages leave every part, previous version, and original input intact',()=>withAssembly(a=>{
 a.applyPackage(fixture());const before=a.snapshot(),geometry=a.parts.get(id).mesh.geometry;
 const cases=[
  ['wrong-machine',p=>p.machine.model='PC751N'],['wrong-frame',p=>p.units='m'],
  ['unknown-part',p=>p.partId='unknown'],['stale-revision',p=>p.fromRevision='exterior-v1'],
  ['invalid-vertices',p=>p.geometry.positions[0]=NaN],['invalid-vertices',p=>p.geometry.positions[0]='0'],
  ['invalid-indices',p=>p.geometry.indices[0]=999999],['invalid-indices',p=>p.geometry.indices[0]=1.5],
  ['empty-surface',p=>p.geometry.positions.fill(0)],['unsupported-field',p=>p.position=[1,2,3]],
  ['invalid-evidence',p=>p.evidence.note=''],['invalid-revision',p=>p.revision=p.fromRevision],
 ];
 for(const [code,mutate] of cases){const p=a.exportPart(id);mutate(p);const input=structuredClone(p);assert.throws(()=>a.applyPackage(p),e=>e.code===code,code);assert.deepEqual(p,input);assert.deepEqual(a.snapshot(),before);assert.equal(a.parts.get(id).mesh.geometry,geometry);}
}));
test('wrong whole envelope and known 110 mm band width reject atomically without fitting',()=>withAssembly(a=>{
 const before=a.snapshot(),p=fixture();for(let i=0;i<p.geometry.positions.length;i+=3)p.geometry.positions[i]-=3000;
 assert.throws(()=>a.applyPackage(p),e=>e.code==='envelope-conflict');assert.deepEqual(a.snapshot(),before);
 const band=a.exportPart('pc752n/crawler/rubber-belt/001');for(let i=2;i<band.geometry.positions.length;i+=3)band.geometry.positions[i]*=2;
 assert.throws(()=>a.applyPackage(band),e=>e.code==='dimension-conflict');assert.deepEqual(a.snapshot(),before);
}));
test('undo restores exact geometry, revision, evidence and package bytes',()=>withAssembly(a=>{
 const before=a.snapshot(),exportBefore=a.exportPart(id),geo=a.parts.get(id).mesh.geometry;
 a.applyPackage(fixture());a.undo(id);assert.equal(a.parts.get(id).mesh.geometry,geo);
 assert.deepEqual(a.snapshot(),before);assert.deepEqual(a.exportPart(id),exportBefore);assert.throws(()=>a.undo(id),e=>e.code==='no-previous');
}));
test('consecutive revisions can undo one step, without skipping to the original',()=>withAssembly(a=>{
 a.applyPackage(fixture());const v1=a.exportPart(id),geo=a.parts.get(id).mesh.geometry;
 a.applyPackage(v1);assert.equal(a.part(id).revision,v1.revision);a.undo(id);
 assert.equal(a.part(id).revision,fixture().revision);assert.equal(a.parts.get(id).mesh.geometry,geo);assert.equal(a.part(id).canUndo,false);
}));
test('strict local JSON size, format and unknown property validation',()=>{
 assert.throws(()=>parsePackage('{'),e=>e.code==='invalid-json');
 assert.throws(()=>parsePackage(' '.repeat(8*1024*1024+1)),e=>e.code==='package-too-large');
 withAssembly(a=>{const p=fixture();p.evidence.reviewStatus='verified';assert.throws(()=>a.applyPackage(p),e=>e.code==='unsupported-field');});
});
test('three independent runs produce identical metadata, geometry and display offsets',()=>{
 const hashes=Array.from({length:3},()=>withAssembly(a=>{a.applyPackage(fixture());return hash({snapshot:a.snapshot(),geometry:a.exportPart(id),offsets:offsets(a)});}));
 assert.equal(new Set(hashes).size,1);
});
test('saved UI export replays the revised geometry into a fresh baseline session',()=>withAssembly(a=>{
 a.applyPackage(fixture());const saved=a.exportPart(id,{fromBaseline:true});
 assert.equal(saved.fromRevision,'exterior-v1');assert.equal(saved.revision,fixture().revision);
 withAssembly(next=>{next.applyPackage(saved);assert.deepEqual(next.exportPart(id),a.exportPart(id));});
}));
