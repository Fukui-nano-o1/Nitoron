const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
let chromium;try{({chromium}=require('playwright'))}catch{({chromium}=require('playwright-core'))} // 環境依存: playwright-core+同梱Chromiumでも動かす
(async()=>{
if(!process.argv[2]) throw Error('Pass the experiment output directory');
const root=path.resolve(process.argv[2]);
const evidence=path.join(root,'browser-evidence');fs.mkdirSync(evidence,{recursive:true});
const html=fs.readFileSync(path.join(root,'viewer.html'),'utf8');
const experiment=JSON.parse(fs.readFileSync(path.join(root,'experiment.json'),'utf8'));
const canFit=experiment.status==='candidates-generated';
const hasPoints=experiment.views.some(v=>v.correspondences?.length);
const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html; charset=utf-8');res.end(req.url==='/broken'?html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'<script type="importmap">{"imports":{}}</script>'):html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.ATLAS_CHROMIUM_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1')&&!r.url().startsWith('data:'))external.push(r.url())});
const url='http://127.0.0.1:'+server.address().port;
await page.goto(url);await page.waitForFunction(()=>window.__atlas3dReady===true);
await page.locator('#scene').screenshot({path:path.join(evidence,'fitted.png')});
if(canFit){
await page.getByRole('button',{name:'奥行き・遠側'}).click();
await page.waitForFunction(()=>document.querySelector('[data-mode="depthFar"]').getAttribute('aria-pressed')==='true');
await page.locator('#scene').screenshot({path:path.join(evidence,'far.png')});
if(fs.readFileSync(path.join(evidence,'fitted.png')).equals(fs.readFileSync(path.join(evidence,'far.png'))))throw Error('mode render unchanged');
}else{
if(!(await page.locator('#fit-status').textContent()).includes('配置計算を停止'))throw Error('missing stop status');
if(!(await page.locator('[data-mode=depthFar]').isDisabled()))throw Error('depth mode must be disabled after stop');
}
if(hasPoints){await page.locator('#diagram circle').first().click();
if(!(await page.locator('#selection').textContent()).includes('形状・位置は仮説'))throw Error('selection failed');}
await page.screenshot({path:path.join(evidence,'mobile.png'),fullPage:true});
if(errors.length)throw Error(errors.join('\n'));
await page.setViewportSize({width:1280,height:900});await page.screenshot({path:path.join(evidence,'desktop.png'),fullPage:true});
await page.goto(url+'/broken');await page.waitForFunction(()=>document.querySelector('#state').textContent.includes('3Dを開始できません'),{},{timeout:10000});
if(hasPoints){await page.locator('#diagram circle').first().click();
if(!(await page.locator('#selection').textContent()).includes('形状・位置は仮説'))throw Error('2D fallback failed');}
if(external.length)throw Error('external requests');
console.log(JSON.stringify({input:root,chromiumWebGL:true,mobile390:true,desktop1280:true,candidateModeChangesPixels:canFit,explicitStopChecked:!canFit,selectionChecked:hasPoints,externalRequests:external.length,primaryPageErrors:0,broken3dPointSelectionChecked:hasPoints},null,2));
await browser.close();await new Promise(r=>server.close(r));
})().catch(e=>{console.error(e);process.exit(1)});
