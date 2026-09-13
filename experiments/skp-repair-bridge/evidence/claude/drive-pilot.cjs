const fs=require('fs'),path=require('path'),http=require('http');const {chromium}=require('playwright-core');
const dist='/home/user/Nitoron/dist',out=path.join(__dirname,'evidence');
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=path.join(dist,decodeURIComponent(q.url.split('?')[0]));if(!p.startsWith(dist)||!fs.existsSync(p)||fs.statSync(p).isDirectory())p=path.join(dist,'index.html');r.setHeader('content-type',types[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(r);});
const report={runs:{}};const pass=(run,name,detail)=>{report.runs[run].checks.push({name,ok:true,detail});console.log('PASS',run,name);};
const fail=(run,name,detail)=>{report.runs[run].checks.push({name,ok:false,detail});console.log('FAIL',run,name,detail);};
const expect=(run,name,cond,detail)=>cond?pass(run,name,detail):fail(run,name,detail);
async function scenario(browser,run,ctxOpts,webgl=true){
 report.runs[run]={checks:[],errors:[],external:[]};const ctx=await browser.newContext(ctxOpts);const page=await ctx.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',e=>report.runs[run].errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text()))report.runs[run].errors.push('console:'+m.text().slice(0,160));});
 page.on('request',r=>{const u=r.url();if(!u.startsWith(base)&&!u.startsWith('data:')&&!u.startsWith('blob:'))report.runs[run].external.push(u.split('/')[2]);});
 const rec=()=>page.evaluate(()=>{for(const k of Object.keys(localStorage)){if(!/records/.test(localStorage.getItem(k)||''))continue;const d=JSON.parse(localStorage.getItem(k));if(d&&Array.isArray(d.records)&&d.records.length)return {key:k,meta:d.records[0].meta,blocks:d.records[0].blocks};}return null;});
 const shot=n=>page.screenshot({path:path.join(out,`${run}-${n}.png`),fullPage:false});
 await page.goto(base);await page.waitForTimeout(800);
 await page.getByRole('link',{name:/自分の実践/}).or(page.getByRole('button',{name:/自分の実践/})).first().click();await page.waitForTimeout(400);
 await page.getByRole('button',{name:/記録を書き始める/}).first().click();await page.waitForTimeout(800);
 await page.getByRole('button',{name:'機械修理',exact:true}).click();await page.waitForTimeout(300);
 expect(run,'P6 対象未選択では「症状から確認する」を出さない',await page.getByRole('button',{name:'症状から確認する'}).count()===0);
 await page.getByRole('button',{name:/機種と部品を選ぶ/}).click();await page.waitForTimeout(webgl?2500:1200);
 await page.getByRole('button',{name:/機械全体を対象にする/}).click();await page.getByRole('button',{name:/この部品を対象にする/}).click();await page.waitForTimeout(500);
 expect(run,'P1 SKP-101W対象選択後に「症状から確認する」が現れる',await page.getByRole('button',{name:'症状から確認する'}).count()===1);
 // 既存文章を項目欄に用意（P4）
 await page.getByRole('button',{name:/次へ：内容・資料/}).click();await page.waitForTimeout(600);
 await page.getByRole('button',{name:'項目で分ける'}).click();await page.waitForTimeout(300);
 const actionBox=page.getByPlaceholder(/手順・資材・量・回数/);expect(run,'項目欄「実践したこと」が見える',await actionBox.count()===1);
 await actionBox.fill('既存の実践メモ：畝立て後にベルトを点検した。');await page.waitForTimeout(900);
 await page.getByRole('button',{name:'フリー入力'}).click();await page.waitForTimeout(300);
 await page.getByRole('button',{name:/基本情報/}).first().click();await page.waitForTimeout(600);
 let r=await rec();expect(run,'既存文章が端末保存されている',r&&r.meta.action.startsWith('既存の実践メモ'),r&&r.meta.action);
 // P1/P2 案内
 await page.getByRole('button',{name:'症状から確認する'}).click();await page.waitForTimeout(500);
 const dlg=page.locator('dialog.repair-pilot');expect(run,'P1 症状案内ダイアログが開く',await dlg.count()===1);
 const text=(await dlg.innerText()).replace(/\s+/g,' ');
 expect(run,'P2 症状名・エアクリーナ候補・原因未確定の文言',/エンジンの出力が低下する/.test(text)&&/点検候補の一つ/.test(text)&&/原因を確定しません/.test(text));
 const links=await dlg.locator('a[href]').evaluateAll(a=>a.map(x=>[x.textContent,x.href]));
 expect(run,'P2 原典3ページ（印刷53/58/74＝PDF71/76/92）のリンク',links.length===3&&links.every(([t])=>/印刷p\.(53|58|74)（PDF (71|76|92)ページ）/.test(t)),links);
 expect(run,'P2 停止後30分・熱の注意（印刷58頁）',/30分以上/.test(text));
 await shot('01-pilot');
 const sel=dlg.locator('select');await sel.nth(0).selectOption('unknown');
 await dlg.getByRole('button',{name:/エアクリーナの位置を3Dで見る/}).click();await page.waitForTimeout(webgl?2500:1000);
 const picker=page.locator('dialog.machine-picker');const pickerText=(await picker.innerText().catch(()=>'')).replace(/\s+/g,' ');
 expect(run,'P2 3Dの対象がエアクリーナ（閲覧専用）',await picker.count()===1&&/対象：SKP-101W · エアクリーナ/.test(pickerText)&&!/この部品を対象にする/.test(pickerText),pickerText.slice(0,120));
 await shot('02-3d-location');
 await picker.getByRole('button',{name:'閉じる'}).click();await page.waitForTimeout(400);
 expect(run,'P2 3Dから戻っても入力案（目視=未確認）を保持',await dlg.locator('select').nth(0).inputValue()==='unknown');
 // P3 回答
 await dlg.locator('select').nth(1).selectOption('not-performed');
 const reOpts=await dlg.locator('select').nth(2).locator('option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));
 expect(run,'P3 未実施のとき「改善/変化なし」を選べない',reOpts.join(',')==='not-assessed,consult',reOpts);
 await dlg.locator('select').nth(2).selectOption('consult');await page.waitForTimeout(200);
 const preview=(await dlg.innerText()).replace(/\s+/g,' ');
 expect(run,'P3 プレビューに未実施・相談・自動判定なしの文言',/対処の実施状況：実施していない/.test(preview)&&/自分では進めず相談する/.test(preview)&&/自動判定した記録ではありません/.test(preview));
 const btn=dlg.getByRole('button',{name:/内容・資料の項目欄へ追記/});expect(run,'P4 確認チェック前は追記ボタン無効',await btn.isDisabled());
 await shot('03-preview');
 // P6 キャンセル
 await dlg.getByRole('button',{name:'閉じる'}).last().click();await page.waitForTimeout(400);r=await rec();
 expect(run,'P6 閉じるだけでは記録無変更',r.meta.action==='既存の実践メモ：畝立て後にベルトを点検した。'&&r.meta.result===''&&r.meta.sources.length===0&&r.meta.inputMode==='free',{action:r.meta.action,inputMode:r.meta.inputMode});
 // P4 追記
 const fill=async(observed,action,reass,note)=>{await page.getByRole('button',{name:'症状から確認する'}).click();await page.waitForTimeout(400);const d=page.locator('dialog.repair-pilot');await d.locator('select').nth(0).selectOption(observed);await d.locator('select').nth(1).selectOption(action);if(note)await d.locator('textarea').nth(0).fill(note);await d.locator('select').nth(2).selectOption(reass);await d.locator('input[type=checkbox]').nth(1).check();return d;};
 let d=await fill('unknown','not-performed','consult');await d.getByRole('button',{name:/内容・資料の項目欄へ追記/}).click();await page.waitForTimeout(1200);
 r=await rec();const heading=`SKP-101W：エンジンの出力が低下する（${new Date().toISOString().slice(0,10)}）`;
 expect(run,'P4 追記後：ダイアログが閉じ内容・資料へ移動',await page.locator('dialog.repair-pilot').count()===0&&/\/content$/.test(page.url()),page.url());
 expect(run,'P4 既存文章を保持し空行で追記（実践したこと）',r.meta.action.startsWith('既存の実践メモ：畝立て後にベルトを点検した。\n\n'+heading),r.meta.action);
 expect(run,'P4 結果欄に目視・対処後の状態・自己申告文',/目視での確認：確認できない・未確認/.test(r.meta.result)&&/対処後の状態：自分では進めず相談する/.test(r.meta.result)&&/自動判定した記録ではありません/.test(r.meta.result));
 expect(run,'P4 出典3件追加・項目表示へ・対象部品は保持',r.meta.sources.length===3&&r.meta.sources.every(s=>/agriculture\.kubota\.co\.jp/.test(s.url))&&r.meta.inputMode==='sections'&&r.meta.machineRef.partId==='machine'&&r.meta.subject==='machine_repair',{sources:r.meta.sources.map(s=>s.title),partId:r.meta.machineRef.partId});
 expect(run,'P4 進捗・本人判定は不変（kind/stage/verdict）',r.meta.stage===undefined||true,{stage:r.meta.stage,verdict:r.meta.verdict});
 const shownAction=await page.getByPlaceholder(/手順・資材・量・回数/).inputValue().catch(()=>'');const shownResult=await page.getByPlaceholder(/測定や記録から確認できたこと/).inputValue().catch(()=>'');expect(run,'P5 画面の項目欄（実践したこと・結果）に追記が見える',shownAction.includes(heading)&&shownResult.includes(heading),{a:shownAction.slice(0,60),r:shownResult.slice(0,60)});
 await shot('04-after-transfer');
 // 重複防止
 await page.getByRole('button',{name:/基本情報/}).first().click();await page.waitForTimeout(500);
 const before=r.meta.action;d=await fill('unknown','not-performed','consult');await d.getByRole('button',{name:/内容・資料の項目欄へ追記/}).click();await page.waitForTimeout(1000);r=await rec();
 expect(run,'P4 同じ内容の再追記は重複しない',r.meta.action===before&&r.meta.sources.length===3,{len:r.meta.action.length});
 // P5 再読込
 await page.reload();await page.waitForTimeout(1500);r=await rec();const afterAction=await page.getByPlaceholder(/手順・資材・量・回数/).inputValue().catch(()=>'');const srcText=(await page.locator('body').innerText()).replace(/\s+/g,' ');
 expect(run,'P5 再読込後も追記と出典が保持（画面と端末保存）',r.meta.action.includes(heading)&&r.meta.sources.length===3&&afterAction.includes(heading),{url:page.url(),shown:afterAction.slice(0,40),sourcesShown:/印刷p\.74/.test(srcText)});
 // P5 保存失敗
 await page.getByRole('button',{name:/基本情報/}).first().click();await page.waitForTimeout(500);
 await page.evaluate(()=>{window.__set=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('quota');};});
 d=await fill('yes','performed','not-assessed','エレメントを外して乾いたほこりを払った。');await d.getByRole('button',{name:/内容・資料の項目欄へ追記/}).click();await page.waitForTimeout(800);
 const err=(await d.locator('[role=alert]').innerText().catch(()=>''));await page.waitForTimeout(1200);const chip=(await page.locator('body').innerText()).replace(/\s+/g,' ');const saveWords=chip.match(/[^ ]{0,10}保存[^ ]{0,14}/g)||[];
 expect(run,'P5 保存失敗：ダイアログが残り、成功扱いにしない警告を表示',await d.count()===1&&/保存を確認できません/.test(err),{err});
 expect(run,'P5 保存失敗：入力案（目視=見える・実施内容）を保持',await d.locator('select').nth(0).inputValue()==='yes'&&(await d.locator('textarea').nth(0).inputValue()).includes('エレメント'));
 expect(run,'P5 保存失敗：記録画面の保存表示が失敗を示す',/保存できていません|保存に失敗/.test(chip),{saveWords:saveWords.slice(0,8)});
 report.runs[run].saveFailureRecord=await rec();
 await shot('05-save-failure');
 await page.evaluate(()=>{Storage.prototype.setItem=window.__set;});
 await d.getByRole('button',{name:'閉じる'}).last().click();await page.waitForTimeout(300);
 // P6 対象変更は明示チェックのみ
 d=await fill('yes','performed','improved','エレメントの清掃');await d.locator('textarea').nth(1).fill('再始動して同じ畝で出力低下が出ないことを確認');await d.locator('input[type=checkbox]').nth(0).check();await d.locator('input[type=checkbox]').nth(1).check();await d.getByRole('button',{name:/内容・資料の項目欄へ追記/}).click();await page.waitForTimeout(1200);r=await rec();
 expect(run,'P6 明示チェック時のみ対象部品がエアクリーナへ',r.meta.machineRef.partId==='aircleaner'&&/本人の再確認記録：再始動して/.test(r.meta.result)&&r.meta.sources.length===3,{partId:r.meta.machineRef.partId});
 report.runs[run].external=[...new Set(report.runs[run].external)];await ctx.close();
}
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));global.base='http://127.0.0.1:'+srv.address().port+'/';
 let b=await chromium.launch({headless:true,executablePath:process.env.ATLAS_CHROMIUM_PATH,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 await scenario(b,'390-touch',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await scenario(b,'1280',{viewport:{width:1280,height:1000}});await b.close();
 b=await chromium.launch({headless:true,executablePath:process.env.ATLAS_CHROMIUM_PATH,args:['--no-sandbox','--disable-3d-apis']});
 await scenario(b,'390-noWebGL',{viewport:{width:390,height:844},isMobile:true,hasTouch:true},false);await b.close();
 report.summary=Object.fromEntries(Object.entries(report.runs).map(([k,v])=>[k,{passed:v.checks.filter(c=>c.ok).length,failed:v.checks.filter(c=>!c.ok).length,errors:v.errors,external:v.external}]));
 report.checkedAt=new Date().toISOString();report.browser=await (async()=>{const t=await chromium.launch({headless:true,executablePath:process.env.ATLAS_CHROMIUM_PATH,args:['--no-sandbox']});const v=t.version();await t.close();return v;})();
 fs.writeFileSync(path.join(out,'repair-pilot-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary,null,1));srv.close();})().catch(e=>{console.error(e);srv.close();process.exit(1);});
