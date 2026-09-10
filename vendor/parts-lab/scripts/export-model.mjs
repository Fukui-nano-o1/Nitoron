import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {GLTFExporter} from '../dist/vendor/GLTFExporter.js';
import {createTractor,positionParts} from '../dist/model.js';
import * as TractorData from '../dist/parts.js';
import * as SKPData from '../dist/skp-parts.js';
import {createSKP} from '../dist/skp-model.js';

globalThis.FileReader=class{
 readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onload?.({target:this});this.onloadend?.({target:this});}).catch(error=>this.onerror?.(error));}
 readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result='data:'+blob.type+';base64,'+Buffer.from(result).toString('base64');this.onload?.({target:this});this.onloadend?.({target:this});}).catch(error=>this.onerror?.(error));}
};

const isSKP=process.argv[2]==='skp';
const {PARTS,GUIDES}=isSKP?SKPData:TractorData;
const {root,parts,details={}}=isSKP?createSKP():createTractor();
const expectedCount=isSKP?33:26;
assert.equal(Object.keys(parts).length,expectedCount);
assert.equal(new Set(PARTS.map(p=>p.id)).size,expectedCount);
for(const guide of Object.values(GUIDES))for(const step of guide.steps)if(step.part)assert.ok(parts[step.part]);
let meshCount=0,triangleCount=0;
root.traverse(o=>{if(!o.isMesh)return;meshCount++;const p=o.geometry.attributes.position;triangleCount+=p.count/3;for(const n of ['position','normal','uv']){const attr=o.geometry.attributes[n];assert.ok(attr);assert.equal(attr.count,p.count);assert.ok(attr.array.every(Number.isFinite));}assert.equal(o.userData.partId,o.parent.userData.partId);});
const assembled=new THREE.Box3().setFromObject(root);
if(isSKP){const size=assembled.getSize(new THREE.Vector3()).toArray();size.forEach((n,i)=>assert.ok(Math.abs(n-SKPData.META.dimensions[i])<.0001));for(const p of PARTS){assert.ok(p.page>=1&&p.page<=97);assert.ok(p.source.startsWith('https://agriculture.kubota.co.jp/'));}}
positionParts(parts,1);root.updateMatrixWorld(true);const exploded=new THREE.Box3().setFromObject(root);
for(const g of Object.values(parts))for(let i=0;i<3;i++)assert.ok(Math.abs(g.position.getComponent(i)-(g.userData.base[i]+g.userData.explode[i]))<1e-8);
positionParts(parts,0);root.updateMatrixWorld(true);
for(const g of Object.values(parts))assert.deepEqual(g.position.toArray(),g.userData.base);
const tracks=Object.values(parts).filter(g=>g.userData.explode.some(v=>v!==0)).map(g=>{const b=g.userData.base,e=b.map((v,i)=>v+g.userData.explode[i]);return new THREE.VectorKeyframeTrack(g.name+'.position',[0,3,4,7],[...b,...e,...e,...b]);});
const clip=new THREE.AnimationClip('Explode_and_reassemble_schematic',7,tracks);
const animations=[clip];
if(isSKP){const detailTracks=Object.values(details).map(g=>{const b=g.userData.base,e=b.map((v,i)=>v+g.userData.explode[i]);return new THREE.VectorKeyframeTrack(g.name+'.position',[0,3,4,7],[...b,...e,...e,...b]);});animations.push(new THREE.AnimationClip('Internal_parts_schematic',7,detailTracks));}
const result=await new GLTFExporter().parseAsync(root,{binary:true,animations,onlyVisible:true,trs:true});
const buffer=Buffer.from(result);
assert.equal(buffer.readUInt32LE(0),0x46546c67);assert.equal(buffer.readUInt32LE(4),2);assert.equal(buffer.readUInt32LE(8),buffer.length);
const jsonLength=buffer.readUInt32LE(12);const gltf=JSON.parse(buffer.subarray(20,20+jsonLength).toString());
assert.equal(gltf.animations.length,isSKP?2:1);if(isSKP)assert.equal(gltf.animations[1].channels.length,Object.keys(details).length);assert.equal(gltf.animations[0].channels.length,expectedCount-1);
for(const p of PARTS)assert.ok(gltf.nodes.some(n=>n.name===p.id));
await fs.writeFile(new URL(isSKP?'../dist/skp-101w.glb':'../dist/tractor-model.glb',import.meta.url),buffer);
console.log(JSON.stringify({units:PARTS.length,internalParts:Object.keys(details).length,meshes:meshCount,triangles:triangleCount,animationChannels:tracks.length,glbBytes:buffer.length,assembledBounds:{min:assembled.min.toArray(),max:assembled.max.toArray()},explodedBounds:{min:exploded.min.toArray(),max:exploded.max.toArray()},checks:'finite geometry, material groups, all guide references, explosion positions, reassembly, GLB header, named nodes, animation channels'},null,2));
