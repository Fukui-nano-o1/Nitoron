// Developer test input only: finer sampling of the SAME assumed shell.
// No claim that more triangles make the machine more accurate.
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createAssembly} from './src/assembly.mjs';
const base=createAssembly(),p=base.exportPart('pc752n/engine/orange-cowling/001');
const sections=[[-663,610,620,80],[-625,605,673,132],[-551,601,703,144],[-454,601,708,143],[-366,604,679,122],[-339,609,635,96]];
const positions=[],indices=[],steps=40;
for(const [x,bottom,top,halfwidth] of sections)for(let j=0;j<=steps;j++){const a=Math.PI*j/steps;positions.push(x,bottom+(top-bottom)*Math.sin(a),halfwidth*Math.cos(a));}
for(let i=0;i<sections.length-1;i++)for(let j=0;j<steps;j++){const a=i*(steps+1)+j,b=a+steps+1;indices.push(a,b,a+1,a+1,b,b+1);}
for(const i of [0,sections.length-1]){const b=i*(steps+1);for(let j=1;j<steps;j++)indices.push(b,b+j,b+j+1);}
for(let i=0;i<sections.length-1;i++){const a=i*(steps+1),b=a+steps+1;indices.push(a,a+steps,b,b,a+steps,b+steps);}
p.geometry={positions,indices};p.revision='verification-shell-40-v1';
p.evidence={basis:'verification-fixture',sourceRefs:['baseline:exterior-v1'],note:'同じ仮定形状の曲面分割数だけを増やす交換検証用。実物精度の改善を主張しません。'};
mkdirSync(new URL('./fixtures/',import.meta.url),{recursive:true});
writeFileSync(new URL('./fixtures/cowling-revision.json',import.meta.url),JSON.stringify(p,null,2)+'\n');
base.dispose();console.log(fileURLToPath(new URL('./fixtures/cowling-revision.json',import.meta.url)));
