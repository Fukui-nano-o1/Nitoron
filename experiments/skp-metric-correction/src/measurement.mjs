import * as T from '../vendor/three.module.js';
export const WHEELS=['frontL','frontR','rearL','rearR'];
export function disposeModel(model){
 const geometry=new Set(),materials=new Set();model.root.traverse(o=>{if(o.isMesh){geometry.add(o.geometry);materials.add(o.material);}});
 geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
export function actualBounds(object){
 object.updateWorldMatrix(true,true);const b=new T.Box3().setFromObject(object,true);
 return {minMm:b.min.toArray().map(v=>v*1000),maxMm:b.max.toArray().map(v=>v*1000),xyzMm:b.getSize(new T.Vector3()).toArray().map(v=>v*1000)};
}
export function surfaceRoundness(model,id,kind='tire'){
 const detail=model.details[id+'__'+kind];let mesh;
 detail.traverse(o=>{if(o.isMesh&&!mesh&&o.material.name===(kind==='tire'?'tire':'ivory'))mesh=o;});
 // Baseline source has the same lathe tessellation but no audit metadata.
 const count=detail.userData.metricAudit?.smoothBodyVertexCount ?? (kind==='tire'?32:24)*64*6;
 const origin=model.parts[id].getWorldPosition(new T.Vector3()),v=new T.Vector3(),slices=new Map();
 for(let i=0;i<count;i++){
  v.fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.matrixWorld).sub(origin);
  const key=Math.round(v.z*1e6),r=Math.hypot(v.x,v.y)*1000;
  if(!slices.has(key))slices.set(key,{min:r,max:r});else{const s=slices.get(key);s.min=Math.min(s.min,r);s.max=Math.max(s.max,r);}
 }
 return {method:'radial-range-per-axial-slice-of-lathe-body',slices:slices.size,maxRadialSpreadMm:Math.max(...[...slices.values()].map(s=>s.max-s.min))};
}
export function measureWheel(model,id){
 model.root.updateMatrixWorld(true);const g=model.parts[id],origin=g.getWorldPosition(new T.Vector3()),tire=model.details[id+'__tire'];
 const b=actualBounds(tire),v=new T.Vector3();let maxRadius=0;
 tire.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).sub(origin);maxRadius=Math.max(maxRadius,Math.hypot(v.x,v.y));}});
 return {id,axleCenterMm:origin.toArray().map(v=>v*1000),circumscribedDiameterMm:maxRadius*2000,spanXYZmm:b.xyzMm,
  lowestYmm:b.minMm[1],nominalDiameterMm:id.startsWith('front')?368:457,
  smoothTire:surfaceRoundness(model,id),smoothRim:surfaceRoundness(model,id,'rim')};
}
export function measureModel(model){
 const b=actualBounds(model.root),wheels=WHEELS.map(id=>measureWheel(model,id));
 const allParts=Object.fromEntries(Object.entries(model.parts).map(([id,g])=>[id,actualBounds(g)]));
 const engineGroup=new T.Box3();for(const id of ['engine','tank','aircleaner','muffler','recoil'])engineGroup.union(new T.Box3().setFromObject(model.parts[id],true));
 return {axes:'X length / Y height / Z width; metres internally',actual:b,nominalXYZmm:[2200,1350,1350],deltaXYZmm:b.xyzMm.map((v,i)=>v-[2200,1350,1350][i]),
  wheels,parts:allParts,engineGroupXYZmm:engineGroup.getSize(new T.Vector3()).toArray().map(v=>v*1000),
  trackMm:{front:Math.abs(wheels[0].axleCenterMm[2]-wheels[1].axleCenterMm[2]),rear:Math.abs(wheels[2].axleCenterMm[2]-wheels[3].axleCenterMm[2])},
  assemblies:Object.keys(model.parts).length,details:Object.keys(model.details).length,documented3dParts:0};
}
