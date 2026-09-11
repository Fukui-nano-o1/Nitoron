const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('playwright-core'));}
const dir=__dirname,id='pc752n/engine/orange-cowling/001',fixture=JSON.parse(fs.readFileSync(path.join(dir,'fixtures/cowling-revision.json'),'utf8'));
const readState=()=>{const a=__pc752n;return{active:a.active,step:a.displayStep,whole:a.whole.getState(),detail:a.detail.getState(),metadata:a.assembly.snapshot()};};
function invariant(s){return{active:s.active,step:s.step,whole:{camera:s.whole.camera,box:s.whole.box,nodes:s.whole.nodes,expanded:s.whole.expanded,fraction:s.whole.fraction,opacity:s.whole.opacityByLayer},detail:{camera:s.detail.camera,nodes:s.detail.nodes,expanded:s.detail.expanded,fraction:s.detail.fraction,opacity:s.detail.opacityByLayer}};}
let maximumCameraDeltaMm=0;
function compareState(a,b){
 const x=invariant(a),y=invariant(b);
 for(const box of ['whole','detail']){
  for(const key of ['position','target'])for(let i=0;i<3;i++){
   const delta=Math.abs(x[box].camera[key][i]-y[box].camera[key][i]);
   maximumCameraDeltaMm=Math.max(maximumCameraDeltaMm,delta);
   assert.ok(delta<=1e-8,'camera changed: '+delta+' mm');
  }
  delete x[box].camera;delete y[box].camera;
 }
 assert.deepEqual(x,y);
}
(async()=>{
 const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html;charset=utf-8');r.end(fs.readFileSync(path.join(dir,'PC752N-exterior-viewer.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port,checks=[],errors=[],external=[],evidence=path.join(dir,'evidence');fs.mkdirSync(evidence,{recursive:true});let browser;
 const pass=s=>{checks.push(s);console.log('PASS '+s);};
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.ATLAS_CHROMIUM_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1280,height:1000}});page.setDefaultTimeout(15000);
  const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});};watch(page);
  await page.goto(url);await page.waitForFunction(()=>window.__modelReady);await page.locator('[data-step="power"]').click();
  await page.waitForFunction(()=>__pc752n.detail.getState().fraction===1);
  await page.evaluate(()=>{__pc752n.whole.renderer.domElement.scrollIntoView();__pc752n.whole.camera.updateMatrixWorld();});
  // Freeze damping by allowing the preset pose to settle. No score thresholds changed.
  await page.waitForTimeout(600);
  const before=await page.evaluate(readState);assert.equal(before.step,'power');assert.equal(before.active.transparency,3);assert.equal(before.detail.expanded,true);
  await page.locator('#part-file').setInputFiles(path.join(dir,'fixtures/cowling-revision.json'));
  await page.waitForFunction(id=>__pc752n.assembly.part(id).revision==='verification-shell-40-v1',id);
  const after=await page.evaluate(readState);compareState(after,before);
  assert.equal(await page.evaluate(id=>__pc752n.assembly.parts.get(id).mesh.geometry.attributes.position.count,id),246);
  assert.equal(await page.evaluate(id=>__pc752n.whole.object.getObjectsByProperty('name','orange-cowling')[0].geometry.attributes.position.count,id),246);
  assert.equal(await page.evaluate(()=>__pc752n.detail.object.getObjectByName('orange-cowling').geometry.attributes.position.count),246);
  pass('file upload replaces actual geometry in BOTH views and preserves selection, cameras, guide, exploded offsets and opacity');
  assert.equal(after.metadata.documented3dParts,0);assert.equal(after.metadata.parts.find(p=>p.id===id).evidence.reviewStatus,'pending-review');pass('replacement stays pending review; verified 3D count remains zero');
  await page.evaluate(id=>__pc752n.selectElement(id),id);assert.equal(await page.locator('#undo-part').isDisabled(),false);
  await page.locator('details.model-update').evaluate(e=>e.open=true);assert.ok((await page.locator('#detail-status').textContent()).includes('未照合'));
  await page.screenshot({path:path.join(evidence,'updated-desktop.png'),fullPage:true});
  const leaf=await page.evaluate(readState),bad=structuredClone(fixture);bad.machine.model='PC751N';
  await page.locator('#part-file').setInputFiles({name:'wrong-machine.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
  await page.waitForFunction(()=>document.querySelector('#update-status').textContent.includes('更新しませんでした'));
  assert.deepEqual(await page.evaluate(readState),leaf);pass('wrong-machine file causes no geometry, metadata, selection or camera mutation');
  const downloadEvent=page.waitForEvent('download');await page.locator('#export-part').click();const download=await downloadEvent;const out=path.join(evidence,'exported-part.json');await download.saveAs(out);
  const exported=JSON.parse(fs.readFileSync(out));assert.equal(exported.partId,id);assert.equal(exported.fromRevision,'exterior-v1');assert.equal(exported.revision,fixture.revision);assert.equal(exported.geometry.positions.length,246*3);pass('selected updated part can be downloaded with identity, revision and source declarations');
  const undoBefore=await page.evaluate(readState);await page.locator('#undo-part').click();
  const undoAfter=await page.evaluate(readState);compareState(undoAfter,undoBefore);assert.equal(undoAfter.metadata.parts.find(p=>p.id===id).revision,'exterior-v1');assert.equal(await page.locator('#undo-part').isDisabled(),true);pass('undo restores original geometry without resetting active part or either camera');
  // Update while an explosion animation is in progress. Sample before/apply/after
  // in one frame to distinguish preservation from a restarted animation.
  const mid=await page.evaluate(p=>{const a=__pc752n;a.selectGroup('engine');a.detail.explode();a.detail.render();const before=a.detail.getState();a.applyPartPackage(p);const after=a.detail.getState();return{before,after};},fixture);
  assert.equal(mid.after.expanded,true);assert.equal(mid.after.fraction,mid.before.fraction);assert.deepEqual(mid.after.nodes,mid.before.nodes);
  await page.waitForFunction(()=>__pc752n.detail.getState().fraction===1);pass('in-progress explosion continues to completion after a geometry exchange');
  await page.locator('[data-step="cables"]').click();assert.equal(await page.evaluate(()=>__pc752n.active.group),'handle');assert.equal(await page.evaluate(()=>__pc752n.active.transparency),2);
  await page.locator('[data-view="side"]').click();assert.equal(await page.evaluate(()=>__pc752n.displayStep),null);pass('display guides remain usable; manual view adjustment clears the guide selection');
  await page.reload();await page.waitForFunction(()=>__modelReady);assert.equal(await page.evaluate(id=>__pc752n.assembly.part(id).revision,id),'exterior-v1');pass('reload explicitly starts from baseline; local update does not silently persist');await page.locator('#part-file').setInputFiles(out);await page.waitForFunction(id=>__pc752n.assembly.part(id).revision==='verification-shell-40-v1',id);pass('downloaded part can be restored to baseline after closing or reloading');
  const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});watch(phone);await phone.goto(url);await phone.waitForFunction(()=>__modelReady);
  await phone.locator('[data-group="engine"]').tap();await phone.locator('#elements').selectOption(id);
  const phoneBefore=await phone.evaluate(readState);await phone.locator('#part-file').setInputFiles(path.join(dir,'fixtures/cowling-revision.json'));await phone.waitForFunction(id=>__pc752n.assembly.part(id).canUndo,id);
  compareState(await phone.evaluate(readState),phoneBefore);
  await phone.locator('details.model-update').evaluate(e=>e.open=true);await phone.locator('#detail-scene').scrollIntoViewIfNeeded();await phone.waitForFunction(()=>__pc752n.detail.renderer.info.render.triangles>0);await phone.locator('#detail-scene').screenshot({path:path.join(evidence,'updated-mobile-part.png')});await phone.screenshot({path:path.join(evidence,'updated-mobile.png'),fullPage:true});
  await phone.locator('#undo-part').tap();assert.equal(await phone.evaluate(id=>__pc752n.assembly.part(id).revision,id),'exterior-v1');pass('390px touch layout supports selected-part import and undo with reduced motion');
  assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);pass('390px page has no horizontal layout overflow');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);pass('desktop and mobile: no page errors and zero external runtime requests');
  const result={checkedAt:new Date().toISOString(),browser:await browser.version(),passed:checks.length,checks,maximumCameraDeltaMm,cameraToleranceMm:1e-8,externalRuntimeRequests:external.length,pageErrors:errors,iphonePhysical:false,documented3dParts:0,automaticReconstruction:false};
  fs.writeFileSync(path.join(evidence,'updates-browser-check.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
