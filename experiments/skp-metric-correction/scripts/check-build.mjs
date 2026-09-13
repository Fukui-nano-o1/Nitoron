import {readFile,writeFile} from 'node:fs/promises';
import {SourceTextModule} from 'node:vm';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const file=new URL('../SKP-101W-metric-viewer.html',import.meta.url),html=await readFile(file,'utf8');
const imports=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
const modules=new Map();
for(const [name,url]of Object.entries(imports)){
 assert.ok(url.startsWith('data:text/javascript;base64,'),name+' must be embedded');
 modules.set(name,new SourceTextModule(Buffer.from(url.split(',')[1],'base64').toString('utf8'),{identifier:name}));
}
const entry=new SourceTextModule(html.match(/<script type="module">([\s\S]*?)<\/script>/)[1],{identifier:'entry'});
await entry.link(specifier=>{assert.ok(modules.has(specifier),'Unembedded import '+specifier);return modules.get(specifier);});
const report={syntaxAndModuleExportsLinked:true,executed:false,webGLTested:false,embeddedModules:modules.size,externalModuleDependencies:0,htmlSha256:createHash('sha256').update(html).digest('hex')};
await writeFile(new URL('../evidence/build-link-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
