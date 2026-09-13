import {readFile,writeFile} from 'node:fs/promises';
const base=new URL('../',import.meta.url),read=p=>readFile(new URL(p,base),'utf8'),uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const files=['baseline/skp-model.js','baseline/skp-geometry.js','baseline/skp-parts.js','src/skp-model.js','src/skp-geometry.js','src/skp-parts.js','src/wheel-spec.mjs','src/measurement.mjs','src/assembly-tree.js'];
function rewrite(text,path){
 return text.replace(/(['"])(\.[^'"]+)\1/g,(all,q,rel)=>{
  const url=new URL(rel,new URL(path,base));let key=url.pathname.slice(base.pathname.length);
  if(key==='src/vendor/three.module.js'||key==='baseline/vendor/three.module.js')key='three';
  else if(key==='src/vendor/RoundedBoxGeometry.js'||key==='baseline/vendor/RoundedBoxGeometry.js')key='rounded';
  else if(key==='vendor/three.module.js')key='three';else if(key==='vendor/OrbitControls.js')key='orbit';
  return files.includes(key)||['three','rounded','orbit'].includes(key)?q+key+q:all;
 });
}
const imports={'three/core':uri(await read('vendor/three.core.js'))};
imports.three=uri((await read('vendor/three.module.js')).replaceAll("'./three.core.js'","'three/core'"));
for(const [key,file]of [['orbit','OrbitControls.js'],['rounded','RoundedBoxGeometry.js']])imports[key]=uri((await read('vendor/'+file)).replaceAll("'./three.module.js'","'three'"));
for(const file of files)imports[file]=uri(rewrite(await read(file),file));
const html=(await read('index.html')).replace('<!-- IMPORTMAP -->','<script type="importmap">'+JSON.stringify({imports})+'</script>').replace('<script type="module" src="./src/viewer.mjs"></script>','<script type="module">'+rewrite(await read('src/viewer.mjs'),'src/viewer.mjs')+'</script>');
await writeFile(new URL('SKP-101W-metric-viewer.html',base),html);console.log(JSON.stringify({bytes:Buffer.byteLength(html),externalRuntimeDependencies:0}));
