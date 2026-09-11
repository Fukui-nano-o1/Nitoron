import * as T from '../vendor/three.module.js';
import {RoundedBoxGeometry} from '../vendor/RoundedBoxGeometry.js';

// Exterior candidate, deliberately independent of atlas priors/cameras.
// All geometry is in millimetres. Only published overall envelope / track width
// are dimensional constraints; curved surfaces, positions and detail sizes are
// manually authored visual estimates from the source ledger, NOT measured CAD.
export const SPEC=Object.freeze({maker:'Kubota',model:'PC752N',variant:'standard rotary / single crawler',length:1470,width:615,height:1020,trackWidth:110,massKg:87,handlePosition:'3rd height setting; normal orientation',source:'S1'});
export const GROUPS=[['crawler','クローラ走行部'],['engine','エンジン外装'],['belt','ベルトカバー'],['frame','フレーム・支持部'],['rotary','ロータリ・防土カバー'],['handle','ハンドル・操作部']];
export function makeModel(){
 const root=new T.Group();root.name='pc752n-exterior-candidate';
 root.userData={model:SPEC.model,units:'mm',documented3dParts:0,automaticReconstruction:false,geometryBasis:'human-authored from official exterior photo; hidden shapes estimated',sources:['S1','S2','S3']};
 const groups=Object.fromEntries(GROUPS.map(([id,label])=>{const g=new T.Group();g.name=id;g.userData={id,label,basis:'visual-estimate',dimensionVerified:false};root.add(g);return[id,g]}));
 const mats={orange:new T.MeshStandardMaterial({color:0xf45116,roughness:.29,metalness:.16}),orangeDark:new T.MeshStandardMaterial({color:0xc72c0b,roughness:.42,metalness:.2}),black:new T.MeshStandardMaterial({color:0x222629,roughness:.52,metalness:.3}),rubber:new T.MeshStandardMaterial({color:0x14181a,roughness:.88}),silver:new T.MeshStandardMaterial({color:0xb8bcbb,roughness:.36,metalness:.65}),steel:new T.MeshStandardMaterial({color:0x626c70,roughness:.47,metalness:.7}),engine:new T.MeshStandardMaterial({color:0x8e9290,roughness:.64,metalness:.5}),yellow:new T.MeshStandardMaterial({color:0xfac127,roughness:.43}),dark:new T.MeshStandardMaterial({color:0x303c43,roughness:.5,metalness:.25})};
 let count=0;
 function mesh(group,geo,mat,name,pos=[0,0,0]){const m=new T.Mesh(geo,mats[mat]);m.position.set(...pos);m.name=name||`${group}-${++count}`;m.castShadow=true;m.receiveShadow=true;m.userData={group,basis:'visual-estimate',dimensionVerified:false};groups[group].add(m);return m;}
 function box(g,n,s,p,mat='black',r=4){return mesh(g,new RoundedBoxGeometry(...s,3,Math.min(r,...s.map(x=>x/3))),mat,n,p);}
 function rod(g,n,a,b,r=9,mat='black'){const av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av);const m=mesh(g,new T.CylinderGeometry(r,r,v.length(),16),mat,n,av.clone().add(bv).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return m;}
 function tube(g,n,points,r=8,mat='black'){return mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),80,r,10,false),mat,n);}
 function disc(g,n,p,r,depth,mat='steel'){const m=mesh(g,new T.CylinderGeometry(r,r,depth,48),mat,n,p);m.rotation.x=Math.PI/2;return m;}
 function plate(g,n,pts,z,depth,mat='silver',bevel=8){const s=new T.Shape();s.moveTo(...pts[0]);for(const p of pts.slice(1))s.lineTo(...p);s.closePath();const geo=new T.ExtrudeGeometry(s,{depth,bevelEnabled:bevel>0,bevelSegments:3,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:30});return mesh(g,geo,mat,n,[0,0,z]);}
 function shell(g,n,sections,mat='orange'){// longitudinal loft of arched cross sections
  const v=[],ix=[],steps=20;
  for(const [x,bottom,top,halfwidth] of sections) for(let j=0;j<=steps;j++){const a=Math.PI*j/steps;v.push(x,bottom+(top-bottom)*Math.sin(a),halfwidth*Math.cos(a));}
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<steps;j++){let a=i*(steps+1)+j,b=a+steps+1;ix.push(a,b,a+1,a+1,b,b+1);}
  // end faces and underside close the shell; no implied internal geometry
  for(const i of [0,sections.length-1]){let base=i*(steps+1);for(let j=1;j<steps;j++)ix.push(base,base+j,base+j+1);}
  for(let i=0;i<sections.length-1;i++){let a=i*(steps+1),b=a+steps+1;ix.push(a,a+steps,b,b,a+steps,b+steps);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setIndex(ix);geo.computeVertexNormals();return mesh(g,geo,mat,n);
 }
 // 1. One central triangular rubber crawler, NOT wheel or twin-track substitution.
 const outer=new T.Shape();outer.moveTo(-475,32);outer.quadraticCurveTo(-530,48,-503,112);outer.lineTo(-392,294);outer.quadraticCurveTo(-366,330,-338,288);outer.lineTo(-202,108);outer.quadraticCurveTo(-167,32,-244,32);outer.closePath();
 const hole=new T.Path();hole.moveTo(-465,65);hole.lineTo(-258,65);hole.quadraticCurveTo(-220,67,-238,104);hole.lineTo(-365,267);hole.lineTo(-470,99);hole.quadraticCurveTo(-486,65,-465,65);outer.holes.push(hole);
 const band=mesh('crawler',new T.ExtrudeGeometry(outer,{depth:110,bevelEnabled:false,curveSegments:24}),'rubber','rubber-belt', [0,0,-55]);band.userData.dimensionVerified={axis:'width',mm:110,source:'S1'};
 for(const [x,y,r] of [[-456,95,57],[-253,95,57],[-367,266,43]]){
  disc('crawler','wheel-rim',[x,y,0],r,105,'black');for(const z of [-57,57]){disc('crawler','hub',[x,y,z],r*.48,8);disc('crawler','axle-boss',[x,y,z*1.08],13,10,'black');for(let a=0;a<5;a++){const th=a*Math.PI*2/5;disc('crawler','wheel-bolt',[x+Math.cos(th)*r*.65,y+Math.sin(th)*r*.65,z],4,10,'silver');}}
 }
 const perimeter=new T.CurvePath();const loop=[[-475,35],[-500,100],[-370,302],[-207,104],[-237,35],[-475,35]];
 for(let i=1;i<loop.length;i++)perimeter.add(new T.LineCurve3(new T.Vector3(loop[i-1][0],loop[i-1][1],0),new T.Vector3(loop[i][0],loop[i][1],0)));
 for(let i=0;i<17;i++){const t=(i+.5)/17,p=perimeter.getPointAt(t),d=perimeter.getTangentAt(t),b=box('crawler','tread-'+i,[29,22,110],p.toArray(),'rubber',3);b.rotation.z=Math.atan2(d.y,d.x);}
 // Low contact lug deliberately establishes the declared ground plane.
 box('crawler','ground-contact-lug',[95,20,110],[-353,10,0],'rubber',2);
 plate('crawler','triangular-carrier',[[-445,100],[-255,100],[-367,258]],-19,38,'steel',5);
 // 2. Engine, orange upper cowling and faceted silver casting.
 box('engine','crankcase',[235,182,235],[-460,436,0],'engine',20);
 const block=box('engine','inclined-cylinder',[167,180,203],[-550,527,0],'engine',12);block.rotation.z=-.28;
 for(let i=0;i<8;i++){const f=box('engine','cooling-fin-'+i,[165,5,230],[-537-i*3,472+i*18,0],'silver',1);f.rotation.z=-.28;}
 shell('engine','orange-cowling',[[-663,610,620,80],[-625,605,673,132],[-551,601,703,144],[-454,601,708,143],[-366,604,679,122],[-339,609,635,96]]);
 // Black inset below the tank. Component height/volume are visual estimates.
 shell('engine','under-cowling',[[-650,582,610,95],[-560,579,627,137],[-420,579,626,133],[-347,590,612,95]],'black');
 mesh('engine',new T.CylinderGeometry(25,26,12,40),'black','fuel-cap',[-448,714,0]);
 for(const z of [-118,118]){
  box('engine','side-vent-cover',[143,95,28],[-430,565,z],'black',15);
  for(let j=0;j<5;j++)box('engine','vent-slot',[107,6,4],[-430,535+j*14,z+Math.sign(z)*16],'rubber',1);
 }
 disc('engine','recoil-housing',[-540,432,-130],88,34,'black');disc('engine','recoil-disc',[-540,432,-151],50,6,'steel');
 for(let i=0;i<14;i++){const a=i*Math.PI*2/14;rod('engine','recoil-fin',[-540+Math.cos(a)*56,432+Math.sin(a)*56,-156],[-540+Math.cos(a)*74,432+Math.sin(a)*74,-156],2.5,'black');}
 tube('engine','starter-cord',[[-532,458,-159],[-440,551,-167],[-355,670,-112]],2,'rubber');rod('engine','starter-handle',[-377,684,-115],[-329,684,-115],9,'black');
 // 3. Characteristic elongated belt cover, not a rectangular box.
 const outline=[[-538,335],[-570,357],[-574,407],[-553,457],[-335,531],[-229,533],[-191,501],[-182,449],[-206,403],[-259,377]];
 plate('belt','silver-belt-cover',outline,120,35,'silver',15);
 plate('belt','orange-belt-inset',[[-531,414],[-514,442],[-332,501],[-253,508],[-319,462],[-502,408]],176,2,'orange',1);
 plate('belt','dark-belt-inset',[[-530,379],[-531,403],[-494,399],[-322,453],[-250,496],[-268,452],[-346,404]],178,2,'dark',1);
 disc('belt','cover-round-boss',[-242,452,162],57,9,'silver');disc('belt','cover-fastener',[-356,418,170],7,7,'steel');
 // 4. Exposed chassis and black wraparound front bumper.
 for(const z of [-135,135]){rod('frame','engine-rail',[-639,322,z],[-167,322,z],13);rod('frame','bumper-diagonal',[-624,336,z],[-678,373,z],12);rod('frame','bumper-upright',[-678,373,z],[-678,473,z],12);}
 rod('frame','bumper-cross',[-678,473,-135],[-678,473,135],12);
 box('frame','gearbox',[135,205,131],[-185,422,0],'steel',13);disc('frame','handle-pivot',[-154,547,0],49,146,'black');
 box('frame','rotary-neck',[174,120,129],[-87,306,0],'orange',10);
 rod('frame','centre-stand',[-128,263,0],[-82,55,0],11,'orange');rod('frame','stand-foot',[-91,48,-82],[-91,48,82],8,'black');
 // 5. Rotor, bent blades and sheet-metal mud covers.
 const rotorX=73,rotorY=188;rod('rotary','rotor-shaft',[rotorX,rotorY,-180],[rotorX,rotorY,180],14.5,'steel');
 box('rotary','centre-chaincase',[76,225,53],[35,287,0],'orange',14);
 for(const z of [-122,122]){
  disc('rotary','blade-carrier',[rotorX,rotorY,z],54,10,'orange');
  for(let j=0;j<4;j++){
   const pts=[[25,-12],[62,-15],[98,-7],[126,20],[144,65],[122,50],[106,25],[71,12],[26,13]];
   const b=plate('rotary','curved-blade',pts,-5,10,'black',1);b.geometry.translate(-0,0,0);b.position.set(rotorX,rotorY,z);b.rotation.z=j*Math.PI/2+(z>0?.2:.7);b.rotation.x=z>0?.14:-.14;
  }
 }
 box('rotary','orange-rotor-deck',[300,24,328],[59,376,0],'orange',4);
 for(const z of [-188,188]){
  // flattened side sheet with folded lips, extending behind the rotor
  const cover=plate('rotary','mudguard', [[-99,336],[-75,370],[201,344],[233,321],[226,304],[-83,307]],z-5,10,'dark',4);
  rod('rotary','cover-edge',[-76,372,z],[202,346,z],5,'steel');
  const rubber=plate('rotary','rubber-skirt',[[155,306],[229,303],[238,140],[208,164],[183,215]],z-4,8,'rubber',0);
 }
 rod('rotary','rear-crossmember',[182,392,-182],[182,392,182],11,'orange');
 rod('rotary','depth-bar',[193,147,0],[193,497,0],11,'steel');rod('rotary','depth-bar-grip',[193,452,0],[193,500,0],13,'black');
 // 6. Rising twin handle rails, sculpted orange console, hand controls/cables.
 shell('handle','orange-pivot-console',[[-211,573,590,39],[-183,579,633,69],[-137,611,700,79],[-78,648,747,72],[-12,684,744,49],[14,704,723,19]]);
 for(const sign of [-1,1]){
  tube('handle','handle-rail',[[-161,539,sign*60],[-71,641,sign*80],[211,816,sign*166],[529,974,sign*276],[645,1006,sign*293.5]],11,'black');
  rod('handle','hand-grip',[645,1006,sign*293.5],[780,1006,sign*293.5],14,'rubber');
  tube('handle','lower-control-rail',[[-126,561,sign*70],[178,770,sign*145],[485,928,sign*258],[654,981,sign*288]],6,'steel');
  box('handle','control-pod',[126,32,58],[586,977,sign*267],'dark',12);
  tube('handle','finger-clutch',[[645,973,sign*294],[718,946,sign*294],[758,944,sign*294]],5,'black');
  tube('handle','control-cable',[[604,988,sign*277],[463,898,sign*231],[145,769,sign*121],[-182,543,sign*80]],2.6,'rubber');
  box('handle','orange-control-tab',[20,12,25],[600,1006,sign*264],'orange',3);
 }
 rod('handle','cross-brace',[370,887,-217],[370,887,217],7,'steel');
 tube('handle','main-shift-lever',[[-147,448,89],[-152,580,164],[207,691,189],[284,700,190]],6,'steel');
 rod('handle','main-shift-grip',[236,700,190],[289,710,190],13,'black');
 box('handle','main-shift-orange',[45,8,16],[259,721,190],'orange',3);
 rod('handle','rotary-shift',[-105,470,-64],[-1,584,-100],5,'steel');box('handle','yellow-shift-grip',[57,19,23],[5,590,-103],'yellow',7);
 rod('handle','upright-control',[501,947,-259],[514,1000,-259],6,'orange');
 // Bounded fastener detail, decorative only; no bolt part-number assertion.
 for(const [x,y,z] of [[-615,338,148],[-304,332,148],[-226,514,154],[-83,379,173],[180,393,187]])disc('frame','visible-fastener',[x,y,z],6,7,'silver');
 root.updateMatrixWorld(true);return {root,groups,mats};
}
export function measure(root){root.updateMatrixWorld(true);const b=new T.Box3().setFromObject(root);return {min:b.min.toArray(),max:b.max.toArray(),length:b.max.x-b.min.x,height:b.max.y-b.min.y,width:b.max.z-b.min.z};}
