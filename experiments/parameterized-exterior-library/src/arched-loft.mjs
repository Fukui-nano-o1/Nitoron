import * as T from '../vendor/three.module.js';

export const LOFT_GENERATOR='arched-loft-v1';
// A family of arched cross-sections, not a general CAD surface or a hollow cover.
// Local axes: X length, Y height, Z width. No machine/placement IDs in this recipe.
export function validateLoft(p){
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['sections','steps'].includes(k)))throw Error('曲面の形式が不正です');
 if(!Number.isInteger(p.steps)||p.steps<4||p.steps>128||p.steps%2)throw Error('曲面分割数は4〜128の偶数にしてください');
 if(!Array.isArray(p.sections)||p.sections.length<2||p.sections.length>64)throw Error('断面は2〜64個にしてください');
 let last=-1;
 for(const s of p.sections){
  if(!Array.isArray(s)||s.length!==4||s.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>10000))throw Error('断面は X・底面高さ・頂点高さ・半幅のmm数値です');
  const[x,b,t,w]=s;
  if(x<=last||t<=b||w<=0)throw Error('断面の順序・高さ・半幅が不正です');last=x;
 }
 if(p.sections[0][0]!==0||Math.min(...p.sections.map(s=>s[1]))!==0)throw Error('断面の原点は先頭X=0・底面の最低Y=0です');
 return structuredClone(p);
}
export function loftDimensions(p){validateLoft(p);return{length:p.sections.at(-1)[0],width:2*Math.max(...p.sections.map(s=>s[3])),height:Math.max(...p.sections.map(s=>s[2]))};}
export function makeArchedGeometry(input,offset=[0,0,0]){
 const p=validateLoft(input);if(!Array.isArray(offset)||offset.length!==3||offset.some(x=>typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>100000))throw Error('配置の原点が不正です');
 const v=[],ix=[],steps=p.steps;
 for(const[x,b,t,w]of p.sections)for(let j=0;j<=steps;j++){const a=Math.PI*j/steps;v.push(x+offset[0],b+offset[1]+(t-b)*Math.sin(a),w*Math.cos(a)+offset[2]);}
 for(let i=0;i<p.sections.length-1;i++)for(let j=0;j<steps;j++){const a=i*(steps+1)+j,b=a+steps+1;ix.push(a,b,a+1,a+1,b,b+1);}
 for(const i of[0,p.sections.length-1]){const b=i*(steps+1);for(let j=1;j<steps;j++)ix.push(b,b+j,b+j+1);}
 for(let i=0;i<p.sections.length-1;i++){const a=i*(steps+1),b=a+steps+1;ix.push(a,a+steps,b,b,a+steps,b+steps);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();
 // Preserve unquantized coordinates for explicit rigid frame conversion later.
 g.userData.precisePositions=v;
 return g;
}
export function configuredLoft(input,{length,width,height,crown=1}){
 const p=validateLoft(input),d=loftDimensions(p);
 if([length,width,height].some(x=>typeof x!=='number'||!Number.isFinite(x)||x<=0||x>5000)||typeof crown!=='number'||!Number.isFinite(crown)||crown<.5||crown>1.5)throw Error('外装寸法・中央のふくらみが範囲外です');
 const sections=p.sections.map(([x,b,t,w])=>{const weight=Math.sin(Math.PI*x/d.length);return[x*length/d.length,b*height/d.height,(b+(t-b)*(1+(crown-1)*weight))*height/d.height,w*width/d.width];});
 // Keep the requested height while changing the longitudinal crown profile.
 const peak=Math.max(...sections.map(s=>s[2]));for(const s of sections){s[1]*=height/peak;s[2]*=height/peak;}
 const result={steps:p.steps,sections};validateLoft(result);return result;
}
