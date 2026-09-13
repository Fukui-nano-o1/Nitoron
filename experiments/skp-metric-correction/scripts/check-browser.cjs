// Claude-side executable check. Codex did not execute this browser script:
// the current cloud browser rejects local HTML navigation by policy.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('playwright-core'));}
(async()=>{
 const base=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(base,'SKP-101W-metric-viewer.html'));
 const evidence=path.join(base,'evidence/claude-browser');fs.mkdirSync(evidence,{recursive:true});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 let browser;const checks=[],pageErrors=[],external=[];const pass=s=>{checks.push(s);console.log('PASS',s);};
 const read=async page=>JSON.parse(await page.locator('#audit').textContent());
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.ATLAS_CHROMIUM_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const mobile of [false,true]){
   const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:1000},isMobile:mobile,hasTouch:mobile});
   const page=await context.newPage(),tag=mobile?'390-touch':'1280';page.setDefaultTimeout(30000);
   page.on('pageerror',e=>pageErrors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:'))external.push(r.url());});
   await page.goto(url);await page.waitForFunction(()=>document.body.dataset.ready==='true');
   let a=await read(page);assert.equal(a.canvasCount,1);assert.deepEqual(a.errors,[]);assert.ok(a.drawCount>0);pass(tag+' WebGL ready, single canvas');
   for(const variant of ['baseline','metricOnly','metricWheels']){
    await page.locator('[data-stage="'+variant+'"]').click();a=await read(page);assert.equal(a.state.variant,variant);assert.equal(a.documented3dParts,0);
   }pass(tag+' all three variants selectable without verified claim');
   await page.locator('#subject').selectOption('rearL');a=await read(page);assert.equal(a.state.subject,'rearL');assert.ok((await page.locator('#metrics').innerText()).includes('457.00'));
   const camera=a.camera;await page.locator('[data-stage="baseline"]').click();assert.deepEqual((await read(page)).camera,camera);
   await page.locator('[data-stage="metricWheels"]').click();assert.deepEqual((await read(page)).camera,camera);pass(tag+' variant change preserves inspection camera');
   await page.locator('#explode').click();assert.equal((await read(page)).state.exploded,true);await page.locator('#explode').click();assert.equal((await read(page)).state.exploded,false);pass(tag+' explode and assemble controls');
   await page.locator('#subject').selectOption('whole');await page.locator('#transparent').click();assert.equal((await read(page)).state.transparent,true);await page.locator('#transparent').click();pass(tag+' exterior transparency controls');
   await page.screenshot({path:path.join(evidence,tag+'-whole.png'),fullPage:true});
   for(const subject of ['frontL','rearL']){await page.locator('#subject').selectOption(subject);await page.locator('#stage').screenshot({path:path.join(evidence,tag+'-'+subject+'.png')});}
   await page.locator('#subject').selectOption('engine');assert.ok((await page.locator('#metrics').innerText()).includes('4.8 L'));assert.ok((await page.locator('#metrics').innerText()).includes('2.5 L'));pass(tag+' engine variant mismatch visible');
   await context.close();
  }
  const failure=await browser.newContext();await failure.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};});
  const p=await failure.newPage();p.on('pageerror',e=>pageErrors.push(e.message));await p.goto(url);await p.waitForFunction(()=>document.body.dataset.ready==='true');
  assert.ok((await p.locator('#status').innerText()).includes('3Dを開けません'));assert.ok((await p.locator('#metrics').innerText()).includes('2248.88'));assert.equal(await p.locator('#explode').isDisabled(),true);pass('WebGL failure retains measured dimensions and disables 3D actions');
  await failure.close();assert.deepEqual(pageErrors,[]);assert.deepEqual(external,[]);pass('no page errors or external runtime requests');
  fs.writeFileSync(path.join(evidence,'browser-check.json'),JSON.stringify({executedAt:new Date().toISOString(),browser:await browser.version(),checks,passed:checks.length,pageErrors,externalRuntimeRequests:external.length,iphonePhysical:false,documented3dParts:0},null,2)+'\n');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
