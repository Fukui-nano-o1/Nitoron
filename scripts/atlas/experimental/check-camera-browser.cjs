// Read-only browser acceptance of the v4 paired diagnostic viewer. Requires local Playwright/Chromium.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'))}catch{({chromium}=require('playwright-core'))}
(async()=>{
 const root=path.resolve(process.argv[2]||''),html=fs.readFileSync(path.join(root,'viewer.html'),'utf8');
 const report=JSON.parse(fs.readFileSync(path.join(root,'camera-comparison.json'),'utf8'));
 const evidence=path.join(root,'camera-browser-evidence');fs.mkdirSync(evidence,{recursive:true});
 const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html;charset=utf-8');res.end(html)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.ATLAS_CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  const errors=[],external=[];
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390});
   await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1'&&url.protocol!=='data:'){external.push(url.href);return route.abort()}return route.continue()});
   page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);
   await page.waitForFunction(()=>window.__cameraReady===true||document.querySelector('#status').textContent.includes('ありません'));
   for(let i=0;i<report.groups.length;i++){
    const g=report.groups[i];await page.locator('#group').selectOption(String(i));
    assert.ok((await page.locator('#status').textContent()).includes(g.status));
    for(const kind of ['affine','grid','centroid']){
     await page.locator('#predictor').selectOption(kind);
     const actual=await page.locator('#diagram > g').evaluateAll(nodes=>nodes.map(n=>{const cross=n.querySelector('[data-prediction-x]');return {id:n.dataset.id,xy:cross?[Number(cross.dataset.predictionX),Number(cross.dataset.predictionY)]:null}}));
     assert.equal(actual.length,g.folds.length);
     for(let j=0;j<actual.length;j++){assert.equal(actual[j].id,g.folds[j].id);const expected=g.folds[j][kind].predictionXY;
      if(expected===null)assert.equal(actual[j].xy,null);else {assert.ok(actual[j].xy);assert.ok(Math.hypot(...actual[j].xy.map((v,k)=>v-expected[k]))<1e-7)}}
    }
    if(g.folds.length){await page.locator('#rows button').first().click();assert.ok((await page.locator('#selection').textContent()).includes(g.folds[0].id));
     assert.deepEqual(JSON.parse(await page.locator('#diagnostics').textContent()).trainingIds,g.folds[0].trainingIds)}
   }
   await page.locator('#predictor').selectOption('affine');await page.screenshot({path:path.join(evidence,`${width}.png`),fullPage:true});await page.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log(JSON.stringify({widths:[390,1280],sameJsonSvgCoordinates:true,nullPredictionsNotDrawn:true,externalRequests:external.length,pageErrors:errors.length,realIPhone:false},null,2));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
