/** Static CPU projection of the actual Three.js meshes. This is not a browser screenshot.
 * View: along +Z from the negative-Z side; horizontal X, vertical Y; metres -> mm.
 * Triangles use a deterministic average-depth painter sort. Occlusion is approximate
 * for intersecting triangles. No perspective, camera fitting, or geometry alteration.
 */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {createSKP as createBaseline} from '../baseline/skp-model.js';
import {createSKP} from '../src/skp-model.js';
import {AUTHORED_RADII_M} from '../src/wheel-spec.mjs';
import {measureModel,disposeModel} from '../src/measurement.mjs';
const out=new URL('../evidence/',import.meta.url);await mkdir(out,{recursive:true});
const ordered=[['baseline',createBaseline()],['metricOnly',createSKP({wheelBodyRadiiM:AUTHORED_RADII_M})],['metricWheels',createSKP()]];
const metrics=Object.fromEntries(ordered.map(([k,m])=>[k,measureModel(m)]));
const labels={baseline:'Baseline / separate XYZ fit',metricOnly:'Metric only / no global scale',metricWheels:'Metric + nominal wheel diameter'};
const n=v=>Number(v.toFixed(3)).toString();
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const text=(x,y,s,size=17,color='#24313a')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${esc(s)}</text>`;
function shell(width,height,title,description){return [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>${esc(title)}</title><desc>${esc(description)}</desc><rect width="100%" height="100%" fill="#f8fafb"/><g font-family="DejaVu Sans,Arial,sans-serif">`];}
const stats=[];
function projectMesh(object,{cx,cy,pxPerMm,center=[0,0,0],stage,panel}){
 object.updateWorldMatrix(true,true);const faces=[];let ordinal=0,total=0,backFacing=0,subpixel=0;
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),ab=new T.Vector3(),ac=new T.Vector3(),normal=new T.Vector3();
 const light=new T.Vector3(-0.35,0.65,-1).normalize();
 object.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible)return;const geo=mesh.geometry,p=geo.attributes.position,index=geo.index,mat=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
  const count=index?index.count:p.count;
  for(let i=0;i<count;i+=3){total++;a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
   ab.subVectors(b,a);ac.subVectors(c,a);normal.crossVectors(ab,ac);const len=normal.length();if(len<1e-15)continue;normal.divideScalar(len);
   if(normal.z>=-1e-9 && mat.side!==T.DoubleSide){backFacing++;continue;}if(normal.z>0)normal.negate();
   const xy=[a,b,c].map(v=>[cx+(v.x*1000-center[0])*pxPerMm,cy-(v.y*1000-center[1])*pxPerMm]);
   const area=Math.abs((xy[1][0]-xy[0][0])*(xy[2][1]-xy[0][1])-(xy[1][1]-xy[0][1])*(xy[2][0]-xy[0][0]))/2;
   // Skip only triangles below 0.00001 pixel²; no mesh simplification or dimension fitting.
   if(area<0.00001){subpixel++;continue;}
   const brightness=0.42+0.58*Math.max(0,normal.dot(light));
   const color='#'+mat.color.clone().multiplyScalar(Math.round(brightness*24)/24).getHexString();
   faces.push({z:(a.z+b.z+c.z)/3,ordinal:ordinal++,color,path:xy.map((v,i)=>(i?'L':'M')+n(v[0])+','+n(v[1])).join('')+'Z'});
  }
 });
 faces.sort((a,b)=>b.z-a.z||a.ordinal-b.ordinal);
 // Adjacent triangles of the same color/depth order can share one path without reordering.
 const paths=[];let previous=null;for(const face of faces){if(previous&&previous.color===face.color)previous.path+=face.path;else{previous={color:face.color,path:face.path};paths.push(previous);}}
 stats.push({stage,panel,sourceTriangles:total,renderedTriangles:faces.length,backFacingExcluded:backFacing,degenerateOrSubpixelExcluded:total-backFacing-faces.length,pxPerMm,centerMm:center});
 return paths.map(f=>`<path d="${f.path}" fill="${f.color}" stroke="${f.color}" stroke-width="0.35" stroke-linejoin="round"/>`).join('');
}
function circle(cx,cy,r){return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="#db4054" stroke-width="1.7"/><path d="M${n(cx-7)},${n(cy)}h14M${n(cx)},${n(cy-7)}v14" stroke="#db4054" stroke-width="1"/>`;}
const wheelScale=.60,W=1440,H=1015,colWidth=460,left=30;
const wheel=shell(W,H,'SKP-101W wheel metric comparison','Static orthographic projection of actual model triangles. Axle centers aligned. Nominal red circle is a software reference, not measured physical tire accuracy.');
wheel.push(text(30,36,'Wheel geometry / common scale and axle-center alignment',25),text(30,64,'CPU SVG projection, not a browser screenshot. Red = nominal circumcircle. 0.60 px/mm. No 99% accuracy claim.',16));
for(const [ci,[key,m]] of ordered.entries()){
 const x=left+ci*colWidth,cx=x+colWidth/2;
 wheel.push(text(x+8,101,labels[key],17));
 for(const [ri,id] of ['frontL','rearL'].entries()){
  const top=123+ri*412,cy=top+192,metric=metrics[key].wheels.find(w=>w.id===id),official=metric.nominalDiameterMm;
  wheel.push(`<rect x="${x}" y="${top}" width="444" height="395" rx="7" fill="#fff" stroke="#dbe3e8"/>`,text(x+12,top+25,`${ri?'Rear':'Front'} left / nominal ${official} mm`,16));
  wheel.push(projectMesh(m.parts[id],{cx,cy,pxPerMm:wheelScale,center:metric.axleCenterMm,stage:key,panel:id}),circle(cx,cy,official*wheelScale/2));
  wheel.push(text(x+12,top+369,`Tire spans X/Y: ${metric.spanXYZmm[0].toFixed(1)} / ${metric.spanXYZmm[1].toFixed(1)} mm`,14),text(x+12,top+391,`Circumscribed diameter: ${metric.circumscribedDiameterMm.toFixed(2)} mm`,14));
 }
}
wheel.push(`<path d="M35,964h60M35,959v10M95,959v10" stroke="#24313a" stroke-width="2"/>`,text(108,969,'100 mm',14),text(30,999,'Tread lugs make rear X/Y spans differ even when the rotational tire body is round. Left wheels shown; right wheels share the same parameters.',15),'</g></svg>');
const wholeScale=.18,wholeH=560;const whole=shell(W,wholeH,'SKP-101W whole model fixed-origin comparison','Static orthographic projection from negative Z. Same world origin and px/mm in all panels. No per-model fit, ground correction, or automatic recentering.');
whole.push(text(30,36,'Whole model / fixed world origin and unchanged scale',25),text(30,64,'CPU SVG projection, not a browser screenshot. No per-model fit or ground correction. 0.18 px/mm. Nominal box is 2200 x 1350 mm.',16));
for(const [ci,[key,m]]of ordered.entries()){
 const x=left+ci*colWidth,cx=x+colWidth/2,ground=430,s=metrics[key];
 whole.push(text(x+8,101,labels[key],17),`<rect x="${x}" y="117" width="444" height="370" rx="7" fill="#fff" stroke="#dbe3e8"/>`);
 whole.push(`<rect x="${n(cx-1100*wholeScale)}" y="${n(ground-1350*wholeScale)}" width="${2200*wholeScale}" height="${1350*wholeScale}" fill="none" stroke="#b57a86" stroke-dasharray="6 4" stroke-width="1"/>`);
 whole.push(projectMesh(m.root,{cx,cy:ground,pxPerMm:wholeScale,stage:key,panel:'whole-fixed-origin'}));
 whole.push(`<path d="M${x+4},${ground}H${x+440}" stroke="#546873" stroke-width="1"/><path d="M${cx},${ground-9}v18M${cx-9},${ground}h18" stroke="#c02a43" stroke-width="1.4"/>`);
 for(const id of ['frontL','rearL']){const w=s.wheels.find(v=>v.id===id);whole.push(circle(cx+w.axleCenterMm[0]*wholeScale,ground-w.axleCenterMm[1]*wholeScale,w.nominalDiameterMm*wholeScale/2));}
 whole.push(text(x+12,457,`Actual L/H/W: ${s.actual.xyzMm.map(v=>v.toFixed(1)).join(' / ')} mm`,14),text(x+12,478,`Lowest model Y: ${s.actual.minMm[1].toFixed(2)} mm`,14));
}
whole.push(`<path d="M35,515h90M35,510v10M125,510v10" stroke="#24313a" stroke-width="2"/>`,text(138,520,'500 mm',14),text(30,549,'Candidate floats/penetrates the Y=0 reference where original authored axle placements require a separate stance correction. No physical stance is certified.',15),'</g></svg>');
for(const [name,data]of [['wheels-orthographic.svg',wheel.join('\n')],['whole-orthographic.svg',whole.join('\n')]]){await writeFile(new URL(name,out),data+'\n');console.log(name,Buffer.byteLength(data),createHash('sha256').update(data+'\n').digest('hex'));}
await writeFile(new URL('orthographic-render.json',out),JSON.stringify({schema:'static-triangle-projection/1',view:'negative-Z-to-positive-Z',projection:'orthographic-X-Y',renderer:'Node mesh triangles; average-depth painter sort',browserScreenshot:false,geometryModified:false,perspectivePhotoMatch:false,completeCatalogue99Percent:false,documented3dParts:0,notes:['Depth sorting is approximate for intersecting triangles.','Wheel panels align only axle centers; whole panels preserve world origin.','Metrics derive from actual world-space vertices. Rear tread extents need not equal the circumcircle.'],panels:stats},null,2)+'\n');
ordered.forEach(([,m])=>disposeModel(m));
