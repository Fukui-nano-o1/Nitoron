import {readFileSync,writeFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8'),uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const imports={'three/core':uri(read('vendor/three.core.js'))};imports.three=uri(read('vendor/three.module.js').replaceAll("'./three.core.js'","'three/core'"));imports.orbit=uri(read('vendor/OrbitControls.js').replaceAll("'./three.module.js'","'three'"));
function rewrite(s){s=s.replaceAll("'../vendor/three.module.js'","'three'").replaceAll("'../vendor/OrbitControls.js'","'orbit'");for(const m of ['catalog','geometry','examples','drawing'])s=s.replaceAll("'./"+m+".mjs'","'"+m+"'");return s;}
for(const m of ['catalog','geometry','examples','drawing'])imports[m]=uri(rewrite(read('src/'+m+'.mjs')));
const html=read('index.html').replace('<!-- IMPORTMAP -->','<script type="importmap">'+JSON.stringify({imports})+'</script>').replace('<script type="module" src="./src/app.mjs"></script>','<script type="module">'+rewrite(read('src/app.mjs'))+'</script>');
writeFileSync(new URL('Nitoron-Reusable-Parts.html',import.meta.url),html);console.log(JSON.stringify({bytes:Buffer.byteLength(html),externalRuntimeDependencies:0}));
