import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const base=new URL('./',import.meta.url);const read=p=>readFile(new URL(p,base),'utf8');const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const imports={};imports['three/core']=uri(await read('vendor/three.core.js'));imports.three=uri((await read('vendor/three.module.js')).replaceAll("'./three.core.js'","'three/core'"));
for(const [key,p] of [['orbit','vendor/OrbitControls.js'],['rounded-box','vendor/RoundedBoxGeometry.js']])imports[key]=uri((await read(p)).replaceAll("'./three.module.js'","'three'"));
imports.model=uri((await read('src/model.mjs')).replaceAll("'../vendor/three.module.js'","'three'").replaceAll("'../vendor/RoundedBoxGeometry.js'","'rounded-box'"));
const app=(await read('src/app.mjs')).replaceAll("'../vendor/three.module.js'","'three'").replaceAll("'../vendor/OrbitControls.js'","'orbit'").replaceAll("'./model.mjs'","'model'");
const html=(await read('index.html')).replace('<!-- IMPORTMAP -->','<script type="importmap">'+JSON.stringify({imports})+'</script>').replace('<script type="module" src="./src/app.mjs"></script>','<script type="module">'+app+'</script>');
const out=new URL('PC752N-exterior-viewer.html',base);await writeFile(out,html);console.log(JSON.stringify({file:fileURLToPath(out),bytes:Buffer.byteLength(html),externalRuntimeDependencies:0}));
