import * as T from './vendor/three.module.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
export function geometryKit(root,definitions){
 const colors={teal:0x159daf,tealDark:0x117684,ivory:0xe1e4df,metal:0x717a7e,silver:0xb4bcbb,black:0x1d2427,tire:0x292c2b,red:0xbd3522,light:0xe4f2ef,soil:0x665442,leaf:0x3e8052,leafLight:0x69a264,tray:0x313a36};
 const mats=Object.fromEntries(Object.entries(colors).map(([k,v])=>[k,new T.MeshStandardMaterial({name:k,color:v,roughness:['tire','soil','leaf','leafLight','tray'].includes(k)?.9:.46,metalness:['silver','metal'].includes(k)?.7:['ivory','teal','tealDark'].includes(k)?.2:.06})]));
 const parts={};
 const details={};
 const piece=(parent,key,name,explode)=>{let owner=parent;while(!owner.userData.partId)owner=owner.parent;const parentId=owner.userData.detailId||owner.userData.partId,g=new T.Group();g.userData={detailId:parentId+'__'+key,parentId,partId:owner.userData.partId,name,detailExplode:explode};parent.add(g);return g;};
 const part=(id,p,e)=>{const g=new T.Group();g.name=id;g.position.set(...p);g.userData={...definitions.find(d=>d.id===id),base:p,explode:e,partId:id};root.add(g);parts[id]=g;return g;};
 const mesh=(g,geo,mat,p=[0,0,0],r=[0,0,0])=>{const m=new T.Mesh(geo,typeof mat==='string'?mats[mat]:mat);m.position.set(...p);m.rotation.set(...r);g.add(m);return m;};
 const box=(g,size,p,mat='metal',r)=>mesh(g,new T.BoxGeometry(...size),mat,p,r);
 const softBox=(g,size,p,mat='metal',r,radius)=>mesh(g,new RoundedBoxGeometry(...size,3,radius??Math.min(...size)*.16),mat,p,r);
 const cyl=(g,r,h,p,mat='metal',axis='y',r2=r,n=40)=>mesh(g,new T.CylinderGeometry(r,r2,h,n),mat,p,axis==='x'?[0,0,Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:[0,0,0]);
 const ring=(g,r,t,p,mat='metal',axis='z')=>mesh(g,new T.TorusGeometry(r,t,12,56),mat,p,axis==='x'?[0,Math.PI/2,0]:axis==='y'?[Math.PI/2,0,0]:[0,0,0]);
 function rod(g,a,b,r=.012,mat='metal'){a=new T.Vector3(...a);b=new T.Vector3(...b);const d=b.clone().sub(a);const m=mesh(g,new T.CylinderGeometry(r,r,d.length(),12),mat,a.clone().add(b).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;}
 const tube=(g,points,r=.012,mat='black')=>mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),18,r,6,false),mat);
 function panel(g,points,thickness,p,mat='ivory',bevel=0){const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const geom=new T.ExtrudeGeometry(s,{depth:Math.max(.001,thickness-2*bevel),bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:4,curveSegments:16,steps:1});geom.translate(0,0,-Math.max(.001,thickness-2*bevel)/2);return mesh(g,geom,mat,p);}
 function bolt(g,p,axis='z',r=.011){cyl(g,r,.015,p,'silver',axis,r,6);}
 function mounted(g,p=[0,0,0],rotation=-.95){const m=new T.Group();m.position.set(...p);m.rotation.z=rotation;g.add(m);return m;}
 function hoodSurface(g){
  // Swept curved shell, traced from the published W exterior photograph.
  // The unseen cross sections are interpolated, not manufacturer CAD.
  const upper=new T.CatmullRomCurve3([[-.40,.135,.195],[-.29,.17,.224],[-.08,.155,.231],[.15,.112,.216],[.29,.035,.192],[.39,-.10,.146]].map(p=>new T.Vector3(...p)));
  const positions=[],uv=[],indices=[],long=48,around=32;
  for(let i=0;i<=long;i++){const p=upper.getPoint(i/long),bottom=-.12+(.014*Math.cos(i/long*Math.PI));for(let j=0;j<=around;j++){const angle=-Math.PI/2+j/around*Math.PI;positions.push(p.x,bottom+(p.y-bottom)*Math.pow(Math.max(0,Math.cos(angle)),.65),p.z*Math.sin(angle));uv.push(i/long,j/around);}}
  for(let i=0;i<long;i++)for(let j=0;j<around;j++){const a=i*(around+1)+j,b=a+around+1;indices.push(a,a+1,b,a+1,b+1,b);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();const m=mesh(g,geo,mats.teal.clone());m.material.side=T.DoubleSide;return m;
 }
 function capsule(g,length,height,depth,p,mat='black'){
  const radius=height/2,half=length/2-radius,s=new T.Shape();s.moveTo(-half,-radius);s.lineTo(half,-radius);s.absarc(half,0,radius,-Math.PI/2,Math.PI/2,false);s.lineTo(-half,radius);s.absarc(-half,0,radius,Math.PI/2,Math.PI*1.5,false);s.closePath();
  const bevel=Math.min(.006,depth*.2),geo=new T.ExtrudeGeometry(s,{depth:depth-2*bevel,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:4,curveSegments:20});geo.translate(0,0,-(depth-2*bevel)/2);return mesh(g,geo,mat,p);
 }
 function finish(dimensions){
  root.updateMatrixWorld(true);
  for(const [id,g] of Object.entries(parts)){
   const inverse=g.matrixWorld.clone().invert(),sets=new Map(),old=[],infos=new Map(),owners=new Map();
   g.traverse(o=>{if(o.userData.detailId&&!o.isMesh)infos.set(o.userData.detailId,{...o.userData});});
   g.traverse(o=>{if(!o.isMesh)return;let owner=o.parent;while(owner!==g&&!owner.userData.detailId)owner=owner.parent;const info=owner===g?null:owner.userData,key=(info?.detailId||id)+'/'+o.material.uuid;old.push(o.geometry);const geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));if(!sets.has(key))sets.set(key,{material:o.material,geometry:[],info});sets.get(key).geometry.push(geometry);});
   g.clear();
   for(const info of infos.values()){const owner=new T.Group();owner.name=info.detailId;owner.userData=info;owners.set(info.detailId,owner);details[info.detailId]=owner;}
   for(const {material,geometry,info} of sets.values()){
    const out=new T.BufferGeometry();
    for(const key of ['position','normal','uv']){const size=key==='uv'?2:3,length=geometry.reduce((sum,geo)=>sum+geo.attributes.position.count*size,0),arr=new Float32Array(length);let start=0;for(const geo of geometry){if(geo.attributes[key])arr.set(geo.attributes[key].array,start);start+=geo.attributes.position.count*size;}out.setAttribute(key,new T.BufferAttribute(arr,size));}
    out.computeBoundingBox();out.computeBoundingSphere();const owner=info?owners.get(info.detailId):g,m=mesh(owner,out,material.clone());m.name=(info?.detailId||id)+'_'+material.name;m.userData={partId:id,detailId:info?.detailId};m.castShadow=true;m.receiveShadow=true;geometry.forEach(geo=>geo.dispose());
   }old.forEach(geo=>geo.dispose());
   const centers=new Map();
   function boundsFor(key){const b=new T.Box3(),owner=owners.get(key);owner.children.forEach(m=>b.union(m.geometry.boundingBox));for(const info of infos.values())if(info.parentId===key)b.union(boundsFor(info.detailId));centers.set(key,b.getCenter(new T.Vector3()));return b;}
   for(const info of infos.values())if(info.parentId===id)boundsFor(info.detailId);
   for(const [key,owner] of owners){const center=centers.get(key);if(!center)throw new Error('Unresolved part parent '+key);owner.children.forEach(m=>{m.geometry.translate(-center.x,-center.y,-center.z);m.geometry.computeBoundingBox();m.geometry.computeBoundingSphere();});const parent=owner.userData.parentId;owner.position.copy(center).sub(centers.get(parent)||new T.Vector3());(owners.get(parent)||g).add(owner);}
  }
  root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const scale=new T.Vector3(dimensions[0]/size.x,dimensions[1]/size.y,dimensions[2]/size.z),matrix=new T.Matrix4().makeScale(...scale.toArray());
  for(const g of Object.values(parts)){g.position.sub(new T.Vector3(center.x,bounds.min.y,center.z)).multiply(scale);g.userData.base=g.position.toArray();g.userData.explode=new T.Vector3(...g.userData.explode).multiply(scale).toArray();g.traverse(o=>{if(o.userData.detailId&&!o.isMesh){o.position.multiply(scale);o.userData.base=o.position.toArray();o.userData.explode=new T.Vector3(...o.userData.detailExplode).multiply(scale).toArray();}if(o.isMesh){o.geometry.applyMatrix4(matrix);o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();}});}
  root.userData.envelopeCalibration='Nominal overall dimensions only. Individual part dimensions and fits are schematic.';
  root.updateMatrixWorld(true);return {root,parts,details};
 }
 return {parts,part,piece,mesh,box,softBox,cyl,ring,rod,tube,panel,bolt,mounted,hoodSurface,capsule,finish};
}
