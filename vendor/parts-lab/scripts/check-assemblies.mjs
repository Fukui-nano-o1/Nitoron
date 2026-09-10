import assert from 'node:assert/strict';
import {createSKP} from '../dist/skp-model.js';
import {createTractor} from '../dist/model.js';
import * as SKP from '../dist/skp-parts.js';
import * as Tractor from '../dist/parts.js';
import {FAULTS} from '../dist/skp-faults.js';
import {createCatalog,positionAssembly} from '../dist/assembly-tree.js';

for(const [name,model,data] of [['SKP-101W',createSKP(),SKP],['tractor',createTractor(),Tractor]]){
 const {root,parts,details={}}=model,catalog=createCatalog(data.PARTS,details,name);
 const snapshots=new Map([...Object.entries(parts),...Object.entries(details)].map(([id,g])=>[id,g.position.toArray()]));
 for(const [id,node] of catalog.nodes){
  assert.equal(new Set(catalog.path(id)).size,catalog.path(id).length,'No cycles');
  for(const child of node.children)assert.equal(catalog.nodes.get(child).parent,id);
 }
 // A tap must choose the immediate child of the current level, including after
 // back navigation; deeper mesh identities cannot skip an assembly.
 root.traverse(o=>{
  if(!o.isMesh)return;
  const partId=o.userData.partId,detailId=o.userData.detailId;
  assert.ok(parts[partId]);if(detailId)assert.ok(details[detailId]);
  const system=catalog.nodes.get(partId).parent;
  assert.equal(catalog.hit('machine',partId,detailId),system);
  assert.equal(catalog.hit(system,partId,detailId),partId);
  if(detailId){const path=catalog.path(detailId);for(let i=0;i<path.length-1;i++)assert.equal(catalog.hit(path[i],partId,detailId),path[i+1]);}
  const unrelated=catalog.nodes.get('machine').children.find(id=>id!==system);
  assert.equal(catalog.hit(unrelated,partId,detailId),null);
 });
 // Internal expansion moves children only. Returning to a different level or
 // opening a symptom guide must reassemble every previously expanded child.
 for(const node of catalog.nodes.values()){
  if(!node.children.length)continue;
  positionAssembly(parts,details,catalog,{scope:node.id,explode:1});
  if(node.kind==='assembly'||node.kind==='part'){
   for(const [id,g] of Object.entries(parts))assert.deepEqual(g.position.toArray(),snapshots.get(id));
   for(const [id,g] of Object.entries(details))if(catalog.nodes.get(id).parent!==node.id)assert.deepEqual(g.position.toArray(),snapshots.get(id));
   assert.ok(node.children.some(id=>details[id].position.toArray().some((v,i)=>v!==snapshots.get(id)[i])));
  }
  positionAssembly(parts,details,catalog,{scope:'machine',explode:0,guide:'inspection'});
  for(const [id,g] of [...Object.entries(parts),...Object.entries(details)])assert.deepEqual(g.position.toArray(),snapshots.get(id));
 }
 for(const guide of Object.values(data.GUIDES))for(const step of guide.steps)if(step.part)assert.ok(catalog.nodes.has(step.part));
 if(name==='SKP-101W'){
  assert.equal(Object.keys(details).length,214);assert.equal(Math.max(...[...catalog.nodes.keys()].map(id=>catalog.path(id).length)),6);
  assert.equal(data.PARTS.filter(p=>catalog.nodes.get(p.id).children.length).length,22);
  for(const f of FAULTS){assert.ok(catalog.nodes.has(f.focus));for(const id of f.parts)assert.ok(parts[id]);assert.ok(f.source.includes('#page='));if(f.guide)assert.ok(data.GUIDES[f.guide]);}
 }
 console.log(name+': hierarchy, tap levels, internal expansion, back/guide reassembly and content references passed');
}
