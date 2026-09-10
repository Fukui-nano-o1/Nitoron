import * as THREE from './vendor/three.module.js';
import {PARTS} from './parts.js';

export function createTractor(){
 const root=new THREE.Group(); root.name='Generic_tractor_structural_demonstrator';
 root.userData={description:'Original schematic model. No real machine dimensions or service specifications. Created 2026-09-09.',units:'schematic',source:'See parts.js for maintenance references'};
 const materials={
  red:new THREE.MeshStandardMaterial({color:0xc53b25,roughness:.3,metalness:.22}),
  redDark:new THREE.MeshStandardMaterial({color:0x922d21,roughness:.45,metalness:.2}),
  metal:new THREE.MeshStandardMaterial({color:0x606a70,roughness:.45,metalness:.66}),
  dark:new THREE.MeshStandardMaterial({color:0x252d31,roughness:.58,metalness:.4}),
  black:new THREE.MeshStandardMaterial({color:0x15191b,roughness:.77,metalness:.08}),
  tire:new THREE.MeshStandardMaterial({color:0x232629,roughness:.94,metalness:0}),
  silver:new THREE.MeshStandardMaterial({color:0xc1c8ca,roughness:.33,metalness:.8}),
  rim:new THREE.MeshStandardMaterial({color:0xe1e3e1,roughness:.35,metalness:.45}),
  filter:new THREE.MeshStandardMaterial({color:0xd4b987,roughness:.88,metalness:0}),
  amber:new THREE.MeshStandardMaterial({color:0xec9024,roughness:.23,metalness:.1,emissive:0x9c4a0b,emissiveIntensity:.1}),
  light:new THREE.MeshStandardMaterial({color:0xeff4f4,roughness:.2,metalness:.28}),
  blue:new THREE.MeshStandardMaterial({color:0x327080,roughness:.43,metalness:.12})
 };
 Object.entries(materials).forEach(([n,m])=>m.name=n);
 const parts={};
 function part(id,position,explosion){const g=new THREE.Group();g.name=id;g.position.set(...position);g.userData={partId:id,base:position,explode:explosion,...PARTS.find(x=>x.id===id)};root.add(g);parts[id]=g;return g;}
 function add(g,geo,mat,pos=[0,0,0],rot=[0,0,0]){const m=new THREE.Mesh(geo,typeof mat==='string'?materials[mat]:mat);m.position.set(...pos);m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
 const box=(g,size,pos,mat='dark',rot=[0,0,0])=>add(g,new THREE.BoxGeometry(...size),mat,pos,rot);
 function rounded(g,size,pos,mat='red',radius=.035){const [x,y,z]=size;const s=new THREE.Shape(),r=Math.min(radius,x/4,y/4);s.moveTo(-x/2+r,-y/2);s.lineTo(x/2-r,-y/2);s.quadraticCurveTo(x/2,-y/2,x/2,-y/2+r);s.lineTo(x/2,y/2-r);s.quadraticCurveTo(x/2,y/2,x/2-r,y/2);s.lineTo(-x/2+r,y/2);s.quadraticCurveTo(-x/2,y/2,-x/2,y/2-r);s.lineTo(-x/2,-y/2+r);s.quadraticCurveTo(-x/2,-y/2,-x/2+r,-y/2);const geo=new THREE.ExtrudeGeometry(s,{depth:z-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r*.55,bevelSegments:2,steps:1,curveSegments:4});geo.translate(0,0,-(z-2*r)/2);return add(g,geo,mat,pos);}
 function cylinder(g,r,h,pos,mat='metal',axis='y',r2=r,segments=24){const rot=axis==='z'?[Math.PI/2,0,0]:axis==='x'?[0,0,Math.PI/2]:[0,0,0];return add(g,new THREE.CylinderGeometry(r,r2,h,segments),mat,pos,rot);}
 function torus(g,r,t,pos,mat='dark',axis='z'){const rot=axis==='x'?[0,Math.PI/2,0]:axis==='y'?[Math.PI/2,0,0]:[0,0,0];return add(g,new THREE.TorusGeometry(r,t,8,40),mat,pos,rot);}
 function rod(g,a,b,r=.015,mat='metal'){a=new THREE.Vector3(...a);b=new THREE.Vector3(...b);const v=b.clone().sub(a);const m=add(g,new THREE.CylinderGeometry(r,r,v.length(),10),mat,a.clone().add(b).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;}
 function hose(g,points,r=.027,mat='black'){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return add(g,new THREE.TubeGeometry(curve,20,r,8,false),mat);}
 function bolts(g,pos,radius,count,axis='z',size=.025){for(let i=0;i<count;i++){const a=i/count*Math.PI*2;let p=[...pos];if(axis==='z'){p[0]+=Math.sin(a)*radius;p[1]+=Math.cos(a)*radius;}else if(axis==='x'){p[1]+=Math.sin(a)*radius;p[2]+=Math.cos(a)*radius;}else{p[0]+=Math.sin(a)*radius;p[2]+=Math.cos(a)*radius;}cylinder(g,size,.025,p,'silver',axis,size,6);}}

 // Longitudinal x axis; front = +x, vertical = y, wheel axle = z.
 const chassis=part('chassis',[0,.66,0],[0,0,0]);
 for(const z of [-.28,.28])box(chassis,[3.05,.15,.09],[.08,0,z]);
 box(chassis,[.76,.1,1.12],[-.8,.26,0]);
 for(const z of [-.67,.67]){box(chassis,[.58,.06,.25],[-.37,.0,z],'metal');rod(chassis,[-.58,.27,z*.7],[-.58,.03,z],.018);for(let i=0;i<5;i++)box(chassis,[.035,.015,.22],[-.59+i*.1,.039,z],'black');}
 rounded(chassis,[.25,.19,1.0],[1.58,-.03,0],'dark');
 for(const z of [-.38,.38])box(chassis,[.05,.03,.07],[1.713,.02,z],'silver');

 const hood=part('hood',[.60,1.35,0],[.24,1.3,0]);
 rounded(hood,[1.56,.39,.88],[0,.025,0]);
 rounded(hood,[1.36,.16,.87],[-.04,.205,0],'red');
 for(const z of [-.452,.452]){
  box(hood,[1.26,.032,.008],[-.025,.045,z],'silver');
  box(hood,[.28,.09,.013],[.37,-.085,z],'black');
  for(let i=0;i<6;i++)box(hood,[.016,.12,.01],[-.55+i*.045,-.105,z],'dark',[0,0,-.18]);
 }
 const grille=part('grille',[1.42,1.23,0],[1.18,.25,0]);
 rounded(grille,[.13,.64,.84],[0,0,0],'red');
 box(grille,[.025,.41,.61],[.086,-.054,0],'black');
 for(let i=0;i<13;i++)box(grille,[.038,.013,.61],[.105,-.235+i*.03,0],'metal');
 for(let s of [-1,1]){rounded(grille,[.052,.10,.21],[.102,.22,s*.24],'light',.012);box(grille,[.056,.025,.12],[.105,.128,s*.265],'amber');}

 for(const [id,side] of [['fenderL',-1],['fenderR',1]]){
  const g=part(id,[-1.06,1.40,side*.81],[-.2,.6,side*.78]);
  rounded(g,[1.15,.12,.46],[.02,.015,0]);
  box(g,[.76,.37,.045],[0,-.205,-side*.2],'red');
  rounded(g,[.08,.13,.22],[-.51,-.04,.06*side],'redDark',.015);
  rounded(g,[.081,.075,.12],[-.562,-.03,.06*side],'amber',.01);
  for(const x of [-.2,.2])rod(g,[x,.05,-side*.17],[x,.19,-side*.17],.014,'black');
  rod(g,[-.2,.19,-side*.17],[.2,.19,-side*.17],.014,'black');
 }
 const seat=part('seat',[-.92,1.35,0],[-.18,.94,0]);
 cylinder(seat,.09,.24,[0,-.20,0],'metal');
 box(seat,[.3,.10,.32],[0,-.05,0]);
 rounded(seat,[.47,.12,.51],[.02,.05,0],'black');
 rounded(seat,[.12,.45,.51],[-.24,.28,0],'black');
 for(const z of [-.145,0,.145])box(seat,[.27,.014,.009],[.03,.12,z],'dark');
 for(const z of [-.31,.31]){rod(seat,[-.22,.06,z*.77],[-.17,.25,z],.02);rounded(seat,[.28,.055,.08],[-.055,.27,z],'black',.012);}
 const controls=part('controls',[-.29,1.36,0],[.18,.7,.65]);
 rounded(controls,[.27,.32,.7],[.11,.02,0],'dark');
 const dash=box(controls,[.012,.14,.46],[-.05,.10,0],'black',[0,0,-.1]);
 for(const z of [-.13,.055]){cylinder(controls,.057,.014,[-.065,.13,z],'rim','x');cylinder(controls,.048,.02,[-.075,.13,z],'black','x');rod(controls,[-.089,.13,z],[-.089,.157,z+.018],.003,'light');}
 rod(controls,[-.03,-.14,0],[-.24,.37,0],.035);
 const steer=new THREE.Group();steer.position.set(-.24,.37,0);steer.rotation.z=.40;controls.add(steer);
 torus(steer,.22,.021,[0,0,0],'black','y');cylinder(steer,.045,.042,[0,0,0],'black');
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod(steer,[0,0,0],[Math.sin(a)*.20,0,Math.cos(a)*.20],.011,'metal');}
 for(const [z,x,h] of [[.35,-.22,.23],[.38,-.50,.32],[-.38,-.46,.2]]){rod(controls,[x,-.36,z],[x-.05,h-.2,z],.012);add(controls,new THREE.SphereGeometry(.035,12,8),'black',[x-.05,h-.2,z]);}

 const rops=part('rops',[-1.24,1.81,0],[-.74,.72,0]);
 for(const z of [-.56,.56]){
  box(rops,[.074,1.30,.065],[0,0,z],'dark',[0,0,-.05]);
  box(rops,[.1,.11,.12],[.032,-.48,z],'metal');
  cylinder(rops,.026,.14,[.034,-.48,z],'silver','z',.026,6);
 }
 box(rops,[.08,.065,1.20],[-.032,.65,0]);
 const canopy=part('canopy',[-.83,2.60,0],[-.34,1.52,0]);
 rounded(canopy,[1.40,.10,1.38],[0,0,0],'red',.04);
 box(canopy,[1.1,.035,1.08],[0,-.075,0],'dark');
 for(const z of [-.45,.45])box(canopy,[1.15,.035,.035],[0,-.105,z],'metal');

 const engine=part('engine',[.45,1.02,0],[.15,.15,.96]);
 rounded(engine,[.87,.40,.47],[0,0,0],'metal',.025);
 rounded(engine,[.91,.14,.51],[0,.24,0],'dark',.025);
 rounded(engine,[.72,.12,.40],[0,.36,0],'silver',.025);
 rounded(engine,[.72,.14,.42],[0,-.255,0],'dark',.025);
 for(let i=0;i<3;i++){
  cylinder(engine,.065,.10,[-.26+i*.26,.45,0],'metal');
  for(const z of [-.249,.249]){box(engine,[.025,.34,.024],[-.34+i*.29,-.005,z],'silver');cylinder(engine,.044,.025,[-.24+i*.26,.02,z*1.075],'dark','z');}
  hose(engine,[[-.28+i*.24,.48,.08],[-.27+i*.24,.53,.18],[-.12+i*.11,.1,.29]],.009,'silver');
 }
 for(const x of [-.37,-.12,.12,.37])for(const z of [-.2,.2])cylinder(engine,.022,.015,[x,.32,z],'silver','y',.022,6);
 hose(engine,[[.31,.24,-.2],[.57,.28,-.19],[.68,.13,-.18]],.045);
 for(const z of [-.26,.26]){rod(engine,[-.3,.14,z],[.29,.14,z],.026,'dark');}
 cylinder(engine,.12,.25,[-.24,-.12,.30],'dark','x');

 const radiator=part('radiator',[1.12,1.11,0],[.88,.18,0]);
 box(radiator,[.13,.53,.65],[0,0,0],'dark');
 for(const y of [-.30,.30])rounded(radiator,[.19,.075,.7],[0,y,0],'metal',.015);
 for(let i=0;i<23;i++)box(radiator,[.16,.009,.62],[.005,-.254+i*.023,0],'silver');
 for(const z of [-.35,.35])box(radiator,[.14,.53,.036],[0,0,z],'black');
 cylinder(radiator,.055,.029,[0,.357,.18],'silver');
 torus(radiator,.22,.021,[-.12,0,0],'dark','x');
 cylinder(radiator,.06,.1,[-.13,0,0],'black','x');
 for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const g=new THREE.Group();g.position.set(-.13,0,0);g.rotation.x=a;radiator.add(g);box(g,[.03,.21,.07],[0,.12,0],'dark',[.30,0,0]);}

 const belt=part('belt',[.945,1.03,0],[.65,.06,.84]);
 for(const [y,z,r] of [[-.19,0,.112],[.20,0,.092],[.05,.235,.075]]){
  cylinder(belt,r,.055,[0,y,z],'metal','x');cylinder(belt,r*.4,.065,[.01,y,z],'silver','x');torus(belt,r,.013,[.035,y,z],'black','x');
 }
 hose(belt,[[.034,-.24,-.10],[.034,.20,-.095],[.034,.288,0],[.034,.10,.30],[.034,-.015,.29],[.034,-.28,.06],[.034,-.24,-.10]],.014);
 cylinder(belt,.10,.15,[-.09,.05,.235],'silver','x');
 for(let i=0;i<8;i++)box(belt,[.09,.01,.11],[-.10,.0+i*.014,.235],'dark');

 const battery=part('battery',[1.15,.79,-.20],[.82,.15,-.94]);
 rounded(battery,[.33,.26,.30],[0,0,0],'black',.018);box(battery,[.34,.035,.31],[0,.143,0],'dark');
 box(battery,[.032,.033,.32],[0,.174,0],'metal');
 for(let i=0;i<3;i++)cylinder(battery,.023,.012,[-.10+i*.10,.168,.055],'black');
 cylinder(battery,.025,.035,[-.10,.176,-.085],'red');cylinder(battery,.025,.035,[.10,.176,-.085],'silver');
 box(battery,[.015,.008,.053],[-.10,.198,-.085],'light');box(battery,[.05,.008,.014],[-.10,.199,-.085],'light');
 hose(battery,[[-.1,.178,-.085],[-.2,.20,-.15],[-.22,-.14,-.13]],.015,'red');
 box(battery,[.18,.095,.004],[0,.025,.152],'rim');

 const airbox=part('airbox',[.42,1.42,-.32],[.1,.55,-.85]);
 // Open tube keeps the cartridge a distinct, selectable object in exploded view.
 const airGeo=new THREE.CylinderGeometry(.127,.127,.47,32,1,true);airGeo.rotateZ(Math.PI/2);add(airbox,airGeo,'black');
 cylinder(airbox,.127,.036,[-.255,0,0],'dark','x');
 for(const x of [-.2,.19])torus(airbox,.128,.008,[x,0,0],'metal','x');
 hose(airbox,[[-.23,-.03,0],[-.39,-.07,.04],[-.4,-.22,.12]],.044);
 const filter=part('filter',[.43,1.42,-.32],[.67,.85,-1.36]);
 cylinder(filter,.097,.38,[0,0,0],'filter','x');
 for(let i=0;i<36;i++){const a=i*Math.PI*2/36;rod(filter,[-.17,Math.cos(a)*.096,Math.sin(a)*.096],[.17,Math.cos(a)*.096,Math.sin(a)*.096],.004,'rim');}
 for(const x of [-.195,.195])cylinder(filter,.106,.03,[x,0,0],'dark','x');
 cylinder(filter,.042,.012,[.216,0,0],'black','x');

 const tank=part('tank',[-.34,1.10,0],[-.2,.33,-1.0]);
 rounded(tank,[.30,.47,.63],[0,0,0],'black',.04);cylinder(tank,.067,.032,[.015,.265,0],'dark');
 for(const z of [-.245,.245])box(tank,[.32,.02,.035],[0,.23,z],'metal');
 const oilfilter=part('oilfilter',[.49,.94,.305],[.3,-.01,1.51]);
 cylinder(oilfilter,.079,.19,[0,0,0],'blue','z');cylinder(oilfilter,.083,.022,[0,0,-.102],'metal','z');
 box(oilfilter,[.084,.036,.014],[0,.013,.097],'rim');
 const exhaust=part('exhaust',[.46,1.51,.36],[.43,.66,.80]);
 cylinder(exhaust,.06,.38,[0,0,0],'dark');cylinder(exhaust,.027,.46,[0,.39,0],'black');
 hose(exhaust,[[0,.62,0],[.01,.66,0],[.085,.66,0]],.027,'black');
 hose(exhaust,[[0,-.19,0],[-.07,-.33,-.04],[-.18,-.39,-.1]],.035,'metal');
 for(let i=0;i<7;i++)torus(exhaust,.062,.005,[0,-.13+i*.045,0],'metal','y');

 const transmission=part('transmission',[-.60,.82,0],[-.65,.05,.88]);
 cylinder(transmission,.23,.52,[.22,0,0],'metal','x');
 rounded(transmission,[.62,.36,.46],[-.25,0,0],'metal',.035);
 for(const x of [-.45,-.25,-.05,.14]){box(transmission,[.027,.4,.48],[x,0,0],'dark');}
 cylinder(transmission,.249,.055,[.49,0,0],'silver','x');bolts(transmission,[.525,0,0],.205,10,'x',.018);
 const frontaxle=part('frontaxle',[1.20,.45,0],[.45,.03,0]);
 cylinder(frontaxle,.082,1.43,[0,0,0],'dark','z');
 rounded(frontaxle,[.31,.21,.27],[0,0,0],'metal');
 for(const z of [-.66,.66]){box(frontaxle,[.15,.22,.115],[0,.025,z],'dark');cylinder(frontaxle,.07,.11,[0,0,z],'silver','z');}
 rod(frontaxle,[-.105,.04,-.6],[-.105,.04,.6],.018,'metal');
 const rearaxle=part('rearaxle',[-1.06,.7,0],[-.71,.05,0]);
 cylinder(rearaxle,.12,1.58,[0,0,0],'dark','z');
 rounded(rearaxle,[.4,.35,.44],[0,0,0],'metal');
 for(const z of [-.72,.72]){cylinder(rearaxle,.16,.13,[0,0,z],'metal','z');bolts(rearaxle,[0,0,z*1.10],.12,8,'z',.017);}

 function wheel(id,x,y,z,r,w,ex){const g=part(id,[x,y,z],ex);const profile=[new THREE.Vector2(r*.50,-w*.5),new THREE.Vector2(r*.75,-w*.51),new THREE.Vector2(r*.91,-w*.42),new THREE.Vector2(r*.95,-w*.27),new THREE.Vector2(r*.95,w*.27),new THREE.Vector2(r*.91,w*.42),new THREE.Vector2(r*.75,w*.51),new THREE.Vector2(r*.50,w*.5)];const geo=new THREE.LatheGeometry(profile,56);geo.rotateX(Math.PI/2);add(g,geo,'tire');
  const n=r>.5?24:20;
  for(let i=0;i<n;i++)for(const s of [-1,1]){const a=i/n*Math.PI*2+(s===1?.055:0);const lug=new THREE.Group();lug.rotation.z=-a;g.add(lug);box(lug,[r*.37,r*.075,w*.58],[0,r*.97,s*w*.23],'tire',[0,s*.5,0]);}
  cylinder(g,r*.535,w*.86,[0,0,0],'rim','z');
  for(const s of [-1,1]){cylinder(g,r*.46,.03,[0,0,s*w*.465],'rim','z');torus(g,r*.495,.015,[0,0,s*w*.46],'silver');cylinder(g,r*.25,.04,[0,0,s*w*.49],'red','z');cylinder(g,r*.13,.085,[0,0,s*w*.52],'metal','z');bolts(g,[0,0,s*w*.54],r*.195,8,'z',r*.027);torus(g,r*.65,.003,[0,0,s*w*.515],'black');}
  return g;
 }
 wheel('wheelFL',1.20,.46,-.80,.45,.30,[.65,.03,-1.10]);
 wheel('wheelFR',1.20,.46,.80,.45,.30,[.65,.03,1.10]);
 wheel('wheelRL',-1.06,.70,-.86,.685,.40,[-.65,.03,-1.15]);
 wheel('wheelRR',-1.06,.70,.86,.685,.40,[-.65,.03,1.15]);

 const hitch=part('hitch',[-1.67,.65,0],[-1.08,.14,0]);
 box(hitch,[.10,.4,.4],[.06,.18,0],'dark');
 for(const s of [-1,1]){rod(hitch,[.08,.05,s*.26],[-.47,-.13,s*.45],.035);rod(hitch,[.05,.32,s*.24],[-.27,-.02,s*.38],.022,'silver');torus(hitch,.047,.015,[-.48,-.13,s*.45],'metal','z');rod(hitch,[-.10,.02,s*.32],[-.35,-.13,s*.20],.012);}
 rod(hitch,[.05,.4,0],[-.43,.27,0],.027,'metal');torus(hitch,.039,.012,[-.46,.26,0],'metal','z');
 cylinder(hitch,.034,.18,[-.11,.10,0],'silver','x');box(hitch,[.21,.055,.27],[-.15,.22,0]);

 // Merge each component by material: detailed geometry, modest draw-call count.
 root.updateMatrixWorld(true);
 for(const [id,g] of Object.entries(parts)){
  const inv=g.matrixWorld.clone().invert(),sets=new Map();
  g.traverse(o=>{if(!o.isMesh)return;const geom=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geom.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld));const key=o.material.uuid;if(!sets.has(key))sets.set(key,{material:o.material,geometries:[]});sets.get(key).geometries.push(geom);});
  const old=[];g.traverse(o=>{if(o.isMesh)old.push(o.geometry);});g.clear();
  for(const {material,geometries} of sets.values()){
   const out=new THREE.BufferGeometry();
   for(const name of ['position','normal','uv']){const size=name==='uv'?2:3;const len=geometries.reduce((n,k)=>n+k.attributes.position.count*size,0);const arr=new Float32Array(len);let cursor=0;for(const geom of geometries){const a=geom.getAttribute(name);if(a)arr.set(a.array,cursor);cursor+=geom.attributes.position.count*size;}out.setAttribute(name,new THREE.BufferAttribute(arr,size));}
   out.computeBoundingBox();out.computeBoundingSphere();const ownMat=material.clone();ownMat.userData={originalOpacity:1,partId:id};const m=add(g,out,ownMat);m.name=id+'_'+material.name;m.userData={partId:id};
   geometries.forEach(geo=>geo.dispose());
  }
  old.forEach(geo=>geo.dispose());
 }
 root.updateMatrixWorld(true);
 return {root,parts,materials};
}

export function positionParts(parts,amount){for(const g of Object.values(parts)){const b=g.userData.base,e=g.userData.explode;g.position.set(b[0]+e[0]*amount,b[1]+e[1]*amount,b[2]+e[2]*amount);}}
