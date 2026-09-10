import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/parts-lab/dist/vendor/three.module.js';
import {createMachineScene} from '../src/machine/engine/scene.js';
import {NODES,MODEL_VERSION,MACHINE_ID,ROOT_PART_ID,resolveMachineRef} from '../src/machine/catalog.js';

const engine=createMachineScene();
after(()=>engine.dispose());
const ref=partId=>({machineId:MACHINE_ID,modelVersion:MODEL_VERSION,partId});
const meshes=[];engine.root.traverse(o=>{if(o.isMesh)meshes.push(o);});
const original=new Map(meshes.map(m=>[m,{color:m.material.color.getHex(),intensity:m.material.emissiveIntensity,visible:m.visible}]));
function assertInFrame(){
  engine.camera.updateMatrixWorld(true);engine.root.updateMatrixWorld(true);
  for(const mesh of meshes.filter(m=>m.visible)){
    const b=mesh.geometry.boundingBox;
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
      const p=new T.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld).project(engine.camera);
      assert.ok(Math.abs(p.x)<1 && Math.abs(p.y)<1 && p.z>-1 && p.z<1,`${mesh.userData.detailId||mesh.userData.partId} clipped: ${p.toArray()}`);
    }
  }
}

test('fixed catalog identifies whole, empty, malformed, unknown ID and unknown model version separately',()=>{
  assert.equal(NODES.length,252);
  assert.equal(NODES.filter(n=>n.kind==='part').length,214);
  assert.equal(resolveMachineRef(ref(ROOT_PART_ID)).status,'whole');
  assert.equal(resolveMachineRef(ref('')).status,'unselected');
  assert.equal(resolveMachineRef(null).status,'unselected');
  assert.equal(resolveMachineRef(ref('engine__plug')).node.name,'点火プラグ外形');
  assert.equal(resolveMachineRef({...ref('engine'),modelVersion:'future'}).status,'unknown-version');
  assert.equal(resolveMachineRef({...ref('engine'),machineId:'other'}).status,'unknown-machine');
  assert.equal(resolveMachineRef(ref('constructor')).status,'unknown-part');
  assert.equal(resolveMachineRef(ref('__proto__')).status,'unknown-part');
  assert.equal(resolveMachineRef(ref(123)).status,'invalid');
});

test('catalog module stays independent of Three and DOM for ordinary records and metadata validation',async()=>{
  const code=await readFile(new URL('../src/machine/catalog.js',import.meta.url),'utf8');
  assert.doesNotMatch(code,/\bimport\s|\bwindow\b|\bdocument\b/);
});

test('every pinned catalog node selects real geometry and fits both portrait and landscape viewports',()=>{
  engine.setReducedMotion(true);
  for(const [w,h] of [[390,420],[800,360]]){
    engine.resize(w,h);
    for(const node of NODES){
      const resolution=engine.focus(ref(node.id),{now:0});
      assert.equal(resolution.node.id,node.id);
      assert.ok(meshes.some(m=>m.visible),'No geometry for '+node.id);
      assertInFrame();
    }
  }
});

test('external cover, hidden element and deep fastener expose only their own subtree',()=>{
  for(const id of ['bonnet','aircleaner__element','frontL__fasteners__a0__bolt']){
    engine.focus(ref(id),{now:0,instant:true});
    assert.equal(engine.state.selected,id);
    for(const mesh of meshes){
      const expected=id==='bonnet' ? mesh.userData.partId==='bonnet' : mesh.userData.detailId===id || mesh.userData.detailId?.startsWith(id+'__');
      assert.equal(mesh.visible,Boolean(expected),'Wrong subtree for '+id);
      if(expected)assert.equal(mesh.material.color.getHex(),0xd31d32);
      else assert.equal(mesh.material.color.getHex(),original.get(mesh).color);
    }
    assertInFrame();
  }
});

test('two pulse cycles settle; cancel restores every mesh and leaves no animation running',()=>{
  engine.setReducedMotion(false);engine.reset({now:0,instant:true});
  engine.focus(ref('engine__plug'),{now:0});
  const chosen=meshes.find(m=>m.visible);
  assert.equal(engine.update(0),true);const bright=chosen.material.color.getHex();
  assert.equal(engine.update(320),true);assert.equal(chosen.material.color.getHex(),bright);
  assert.equal(engine.update(870),true);assert.notEqual(chosen.material.color.getHex(),bright);
  engine.update(1420);assert.equal(chosen.material.color.getHex(),bright);
  engine.update(1970);assert.notEqual(chosen.material.color.getHex(),bright);
  assert.equal(engine.update(2520),false);assert.equal(chosen.material.color.getHex(),bright);
  engine.reset({now:2600,instant:true});
  for(const mesh of meshes){assert.equal(mesh.visible,original.get(mesh).visible);assert.equal(mesh.material.color.getHex(),original.get(mesh).color);assert.equal(mesh.material.emissiveIntensity,original.get(mesh).intensity);}
  assert.equal(engine.update(2600),false);assertInFrame();
});

test('changing cards during a zoom replaces the target; reduced motion ends immediately',()=>{
  engine.focus(ref('bonnet'),{now:0});engine.update(100);
  engine.focus(ref('frontL__fasteners__a0__bolt'),{now:100});
  engine.setReducedMotion(true);
  assert.equal(engine.state.selected,'frontL__fasteners__a0__bolt');
  assert.equal(engine.update(100),false);assertInFrame();
  engine.setReducedMotion(false);
});

test('unknown version/ID after valid focus resets whole view with no false highlight',()=>{
  engine.focus(ref('aircleaner__element'),{now:0,instant:true});
  const r=engine.focus({...ref('aircleaner__element'),modelVersion:'future'},{now:0,instant:true});
  assert.equal(r.status,'unknown-version');assert.equal(engine.state.selected,null);
  for(const mesh of meshes){assert.equal(mesh.visible,original.get(mesh).visible);assert.equal(mesh.material.color.getHex(),original.get(mesh).color);}
  assert.equal(engine.focus(ref('missing'),{now:0,instant:true}).status,'unknown-part');
  assertInFrame();
});

test('zero-size hidden host is ignored and returning to a visible host reframes safely',()=>{
  assert.equal(engine.resize(0,0),false);assert.equal(engine.resize(NaN,100),false);
  engine.focus(ref('cup__half-a'),{now:0,instant:true});
  assert.equal(engine.resize(390,390),true);assertInFrame();
});

test('inspection scope expands its children, selects without hiding siblings, and card focus reassembles',()=>{
  engine.reset({now:0,instant:true});
  const positions=new Map();engine.root.traverse(o=>{if(!o.isMesh)positions.set(o.uuid,o.position.clone());});
  assert.equal(engine.setScope('frontL__fasteners',{explode:1,now:0}),true);
  assert.equal(engine.state.scope,'frontL__fasteners');
  engine.resize(390,420);assertInFrame();
  const visible=meshes.map(m=>m.visible);
  assert.ok(engine.selectInScope(ref('frontL__fasteners__a0__bolt'),{now:0}));
  assert.deepEqual(meshes.map(m=>m.visible),visible);
  assert.equal(engine.selectInScope(ref('engine__plug'),{now:0}),false);
  engine.focus(ref('bonnet'),{now:0,instant:true});
  engine.root.traverse(o=>{if(positions.has(o.uuid))assert.ok(o.position.distanceTo(positions.get(o.uuid))<1e-10);});
  assert.equal(engine.state.scope,ROOT_PART_ID);
});

test('inspection ray picks an immediate child and cannot skip hierarchy levels',()=>{
  for(const scope of ['machine','frontL','frontL__fasteners']){
    engine.setScope(scope,{explode:.7,now:0});engine.resize(600,600);
    const children=NODES.find(n=>n.id===scope).children;let hits=0;
    for(let x=-.9;x<=.9;x+=.1)for(let y=-.9;y<=.9;y+=.1){const id=engine.pick(x,y);if(id){hits++;assert.ok(children.includes(id),'Skipped a level: '+id);}}
    assert.ok(hits>0,'No pickable child for '+scope);
  }
});

test('dispose releases geometry and materials once and prevents reuse',()=>{
  const instance=createMachineScene();
  const geometries=new Set(),materials=new Set();let g=0,m=0;
  instance.root.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);}});
  for(const geo of geometries)geo.addEventListener('dispose',()=>g++);
  for(const mat of materials)mat.addEventListener('dispose',()=>m++);
  instance.dispose();instance.dispose();
  assert.equal(g,geometries.size);assert.equal(m,materials.size);
  assert.equal(instance.scene.children.length,0);assert.equal(instance.state.disposed,true);
  assert.throws(()=>instance.focus(ref('engine')),/disposed/);
});
