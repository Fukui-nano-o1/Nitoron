import {makeArchedGeometry} from './arched-loft.mjs';
import * as T from '../vendor/three.module.js';
import {validateRecipe,canonical,refOf} from './catalog.mjs';
const MATERIALS={steel:0xa5afb4,black:0x263139,orange:0xe97731};
export function validateRoute(route){if(!Array.isArray(route)||route.length<2||route.length>40||route.some(p=>!Array.isArray(p)||p.length!==3||p.some(x=>typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>10000)))throw new Error('ケーブル経路は2〜40点のmm座標が必要です');for(let i=1;i<route.length;i++)if(Math.hypot(...route[i].map((x,j)=>x-route[i-1][j]))<.001)throw new Error('隣接する経路点を重ねないでください');return structuredClone(route);}
function annulus(outer,inner,h,hex=false){const s=new T.Shape(),n=hex?6:64;for(let i=0;i<n;i++){const a=i/n*Math.PI*2;const x=outer*Math.cos(a),y=outer*Math.sin(a);i?s.lineTo(x,y):s.moveTo(x,y);}s.closePath();const hole=new T.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);s.holes.push(hole);const g=new T.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,curveSegments:32});g.rotateX(-Math.PI/2);return g;}
// Explicit helical surface; visual thread profile, NOT a certified ISO thread.
function thread(p,lod){const circum=lod==='detail'?64:16,ny=Math.ceil(p.length/p.pitch*(lod==='detail'?20:4)),v=[],ix=[];for(let j=0;j<=ny;j++){const y=j/ny*p.length;for(let i=0;i<=circum;i++){const a=i/circum*Math.PI*2,phase=((y/p.pitch-i/circum)%1+1)%1,crest=Math.max(0,1-Math.abs(phase-.5)*2);const r=p.diameter/2-p.threadDepth*(1-crest);v.push(Math.cos(a)*r,y,Math.sin(a)*r);}}
 for(let j=0;j<ny;j++)for(let i=0;i<circum;i++){const a=j*(circum+1)+i,b=a+circum+1;ix.push(a,a+1,b,a+1,b+1,b);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setIndex(ix);geo.computeVertexNormals();return geo;}
function template(recipe,lod,route){const p=recipe.params,root=new T.Group();const material=new T.MeshStandardMaterial({color:MATERIALS[recipe.material],metalness:recipe.material==='steel'?.7:0,roughness:.4,side:T.DoubleSide});function add(name,g,pos=[0,0,0]){const m=new T.Mesh(g,material);m.name=name;m.position.set(...pos);root.add(m);return m;}
 if(recipe.family==='archedLoft')add('arched-shell',makeArchedGeometry(p));
 else if(recipe.family==='bolt'){add('hex-head',new T.CylinderGeometry(p.headAcrossFlats/Math.sqrt(3),p.headAcrossFlats/Math.sqrt(3),p.headHeight,6),[0,-p.headHeight/2,0]);if(lod==='detail'){add('helical-thread',thread(p,lod));add('tip',new T.CircleGeometry(p.diameter/2-p.threadDepth,32),[0,p.length,0]).rotation.x=-Math.PI/2;}else add('simplified-shank',new T.CylinderGeometry(p.diameter/2,p.diameter/2,p.length,16),[0,p.length/2,0]);}
 else if(recipe.family==='nut')add('hex-with-bore',annulus(p.acrossFlats/Math.sqrt(3),p.bore/2,p.height,true));
 else if(recipe.family==='washer')add('annular-washer',annulus(p.outer/2,p.inner/2,p.thickness));
 else if(recipe.family==='cable'){const curve=new T.CatmullRomCurve3(route.map(x=>new T.Vector3(...x)));add('routed-cable',new T.TubeGeometry(curve,lod==='detail'?Math.min(512,route.length*40):Math.min(128,route.length*10),p.diameter/2,lod==='detail'?16:6,false));root.userData.pathLengthMm=curve.getLength();}
 else if(recipe.family==='ribbedPanel'){add('base-panel',new T.BoxGeometry(p.width,p.thickness,p.height),[0,p.thickness/2,0]);const pitch=p.width/p.ribCount;for(let i=0;i<p.ribCount;i++)add('rib-'+i,new T.BoxGeometry(p.ribWidth,p.ribHeight,p.height),[-p.width/2+pitch*(i+.5),p.thickness+p.ribHeight/2,0]);}
 root.userData={...root.userData,assetRef:refOf(recipe),family:recipe.family,lod,geometryBasis:'parameterized-visual-model',documented3dParts:0};return root;
}
export class GeometryPool{
 #cache=new Map();#active=new Map();#builds=0;
 acquire(input,{instanceId,machineId,lod='detail',route,position=[0,0,0],quaternion=[0,0,0,1]}={}){
  const r=validateRecipe(input);if(!instanceId||typeof instanceId!=='string'||instanceId.length>150||!machineId||typeof machineId!=='string'||machineId.length>150||this.#active.has(instanceId))throw new Error('機種・取付個体IDが不正または重複しています');
  if(!['detail','overview'].includes(lod)||!Array.isArray(position)||position.length!==3||position.some(x=>typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>10000))throw new Error('表示精度・配置が不正です');
  if(!Array.isArray(quaternion)||quaternion.length!==4||quaternion.some(x=>typeof x!=='number'||!Number.isFinite(x))||Math.abs(Math.hypot(...quaternion)-1)>1e-6)throw new Error('回転は正規化した四元数で指定してください');
  const points=r.family==='cable'?validateRoute(route):null;if(r.family!=='cable'&&route!==undefined)throw new Error('剛体部品に経路は指定できません');
  const key=canonical({generator:r.generator,family:r.family,params:r.params,lod,route:points});let entry=this.#cache.get(key);
  if(!entry){if(this.#cache.size>=64){const free=[...this.#cache].find(([,e])=>e.count===0);if(!free)throw new Error('使用中の形状が上限に達しました');this.#dispose(free[1].root);this.#cache.delete(free[0]);}entry={root:template(r,lod,points),count:0};this.#cache.set(key,entry);this.#builds++;}
  const root=entry.root.clone(true);root.position.set(...position);root.quaternion.set(...quaternion);root.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.color.setHex(MATERIALS[r.material]);}});
  root.userData={...entry.root.userData,assetRef:refOf(r),instanceId,machineId,fitStatus:'unconfirmed',documented3dParts:0};entry.count++;this.#active.set(instanceId,{key,root});return root;
 }
 release(root){const id=root?.userData.instanceId,e=this.#active.get(id);if(!e||e.root!==root)return false;root.traverse(m=>{if(m.isMesh)m.material.dispose();});this.#cache.get(e.key).count--;this.#active.delete(id);return true;}
 #dispose(root){const gs=new Set(),ms=new Set();root.traverse(m=>{if(m.isMesh){gs.add(m.geometry);ms.add(m.material);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}
 dispose(){for(const {root} of [...this.#active.values()])this.release(root);for(const e of this.#cache.values())this.#dispose(e.root);this.#cache.clear();}
 get stats(){return {geometryBuilds:this.#builds,cachedShapes:this.#cache.size,liveInstances:this.#active.size};}
}
