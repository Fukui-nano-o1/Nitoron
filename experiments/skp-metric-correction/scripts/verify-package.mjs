import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=new URL('../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const list=JSON.parse(await readFile(new URL('SHA256.json',base)));
for(const [file,hash]of Object.entries(list.files)){
 assert.ok(!file.startsWith('/')&&!file.split('/').includes('..'),'unsafe manifest path');
 assert.equal(sha(await readFile(new URL(file,base))),hash,file);
}
for(const [directory,file]of [['baseline/','baseline/source-identities.json'],['vendor/','baseline/vendor-identities.json']]){
 const expected=JSON.parse(await readFile(new URL(file,base)));
 for(const [name,entry]of Object.entries(expected.files)){
  const b=await readFile(new URL(directory+name,base));
  assert.equal(sha(b),entry.sha256,name);
  assert.equal(createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex'),entry.gitBlob,name);
 }
}
console.log(JSON.stringify({verifiedFiles:Object.keys(list.files).length,baselineAndVendorGitBlobsVerified:8}));
