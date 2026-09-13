const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');const {chromium}=require('playwright-core');
const dist='/home/user/Nitoron/dist',out=path.join(__dirname,'evidence');
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=path.join(dist,decodeURIComponent(q.url.split('?')[0]));if(!p.startsWith(dist)||!fs.existsSync(p)||fs.statSync(p).isDirectory())p=path.join(dist,'index.html');r.setHeader('content-type',types[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(r);});
const report={runs:{}};let cur;const ok=(n,d)=>{report.runs[cur].checks.push({name:n,ok:true,detail:d});console.log('PASS',cur,n);};const bad=(n,d)=>{report.runs[cur].checks.push({name:n,ok:false,detail:d});console.log('FAIL',cur,n,JSON.stringify(d).slice(0,300));};const ex=(n,c,d)=>c?ok(n,d):bad(n,d);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex').slice(0,10);
async function setup(browser,run,ctxOpts){cur=run;report.runs[run]={checks:[],errors:[],external:[]};const ctx=await browser.newContext(ctxOpts);const page=await ctx.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',e=>report.runs[run].errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource|WebGL/.test(m.text()))report.runs[run].errors.push('console:'+m.text().slice(0,160));});page.on('request',r=>{const u=r.url();if(!u.startsWith(base)&&!u.startsWith('data:')&&!u.startsWith('blob:'))report.runs[run].external.push(u.split('/')[2]);});
 const recs=()=>page.evaluate(()=>{for(const k of Object.keys(localStorage)){if(!/"records"/.test(localStorage.getItem(k)||''))continue;const d=JSON.parse(localStorage.getItem(k));if(d&&Array.isArray(d.records))return {key:k,records:d.records};}return {key:null,records:[]};});
 const rec=async id=>{const r=await recs();return r.records.find(x=>x.id===id)||null;};
 const shot=(n,loc)=>(loc||page).screenshot({path:path.join(out,`${run}-${n}.png`)});
 const dlg=cls=>page.locator(`dialog.${cls}`);
 return {ctx,page,recs,rec,shot,dlg};}
async function fullFlow(browser,run,ctxOpts,{webgl=true}={}){
 const {ctx,page,recs,rec,shot,dlg}=await setup(browser,run,ctxOpts);const wait=ms=>page.waitForTimeout(ms);
 // U1/U2: 入口と初回案内
 await page.goto(base+'#/repairs');await wait(1500);
 ex('U1 修理入口（#/repairs）が開く',/機械の修理/.test(await page.locator('h1').first().textContent()));
 ex('U2 初回案内が表示（設定キー未設定）',await dlg('repair-intro').count()===1);
 await dlg('repair-intro').getByRole('button',{name:'次へ'}).click();await wait(200);await dlg('repair-intro').getByRole('button',{name:'次へ'}).click();await wait(200);
 ex('U2 3枚目で「はじめる」',await dlg('repair-intro').getByRole('button',{name:'はじめる'}).count()===1);await dlg('repair-intro').getByRole('button',{name:'はじめる'}).click();await wait(300);
 await page.reload();await wait(1200);ex('U2 再読込で初回案内を再表示しない',await dlg('repair-intro').count()===0);
 await page.getByRole('button',{name:'使い方'}).click();await wait(300);ex('U2 「使い方」で案内を再表示できる',await dlg('repair-intro').count()===1);await dlg('repair-intro').getByRole('button',{name:'スキップ'}).click();await wait(200);
 await shot('01-repairs-home');
 // 修理をはじめる（発表フォームを経由しない）
 await page.getByRole('button',{name:'修理をはじめる'}).first().click();await wait(1500);
 const url1=page.url();const id=(url1.match(/#\/repair\/([^/?]+)/)||[])[1];ex('U1 「修理をはじめる」で修理詳細へ（#/repair/id）',!!id,url1);
 const detailText=(await page.locator('article.repair-detail').innerText().catch(()=>'')).replace(/\s+/g,' ');
 ex('U1 修理詳細に発表項目（作物・地域・発表者）がない',!/作物|地域|発表者名|所属クラブ/.test(detailText)&&/症状/.test(detailText)&&/結果を残す/.test(detailText));
 let r0=await rec(id);ex('U1 記録は machine_repair で機械全体を保持',r0?.meta?.subject==='machine_repair'&&r0.meta.machineRef?.partId==='machine',r0?.meta?.machineRef);
 await page.waitForFunction(()=>document.querySelector('.repair-machine-canvas canvas')||document.querySelector('.repair-machine-canvas .machine-viewer-fallback')?.textContent.includes('表示できません'),null,{timeout:30000}).catch(()=>{});
 await shot('02-repair-detail');
 // 発表側が壊れていない
 await page.goto(base+'#/mine');await wait(1000);await page.getByRole('button',{name:/記録を書き始める/}).first().click();await wait(1000);
 const edText=(await page.locator('body').innerText()).replace(/\s+/g,' ');
 ex('U1 通常発表の編集が開き、修理切替を要求しない',/基本情報/.test(edText)&&/作物/.test(edText)&&!/機械修理/.test(edText));
 await page.goto(base+'#/repairs');await wait(1000);const rows=page.locator('a.repair-history-row');ex('U1 修理一覧に修理記録が1件（発表は混ざらない）',await rows.count()===1);
 await rows.first().click();await wait(1200);const r1=await rec(id);ex('U1 往復で記録が書き換わらない',JSON.stringify(r0)===JSON.stringify(r1));
 // U3: 案内
 await page.getByRole('button',{name:'症状を確認する'}).click();await wait(600);const pilot=dlg('repair-pilot');ex('U3 案内が開く（1/3）',await pilot.count()===1&&/1 \/ 3/.test(await pilot.innerText()));
 r0=await rec(id);ex('U3 症状名が記録に保存される',r0.meta.issue==='エンジンの出力が低下する',r0.meta.issue);
 const mainText=(await pilot.innerText()).replace(/\s+/g,' ');ex('U3 主画面は短い（説明本文・原典リンクは収納）',!/説明書を開く/.test(mainText)&&mainText.length<400,mainText.length);
 const pages=[];for(let i=0;i<3;i++){await pilot.getByRole('button',{name:'条件と操作を確認'}).click();await wait(300);const sh=dlg('repair-guide-sheet');const link=await sh.locator('a.repair-guide-manual').innerText();pages.push(link.replace(/\s+/g,' '));await sh.locator('input[type=checkbox]').check();await sh.getByRole('button',{name:'案内に戻る'}).click();await wait(200);if(i<2){await pilot.getByRole('button',{name:'次へ'}).click();await wait(200);}}
 ex('U3 3手順の原典（印刷53/58/74＝PDF71/76/92）へ到達',pages.length===3&&/53.*71/.test(pages[0])&&/58.*76/.test(pages[1])&&/74.*92/.test(pages[2]),pages);
 await pilot.getByRole('button',{name:'根拠'}).click();await wait(200);const sourcesText=(await dlg('repair-guide-sheet').innerText()).replace(/\s+/g,' ');ex('U3 「根拠」に点検候補・型式限定の注記',/点検候補の一つ/.test(sourcesText)&&/SKP-101W/.test(sourcesText));await dlg('repair-guide-sheet').getByRole('button',{name:'閉じる'}).last().click();await wait(200);
 ex('U3 収納を閉じても案内の位置（3/3）を保持',/3 \/ 3/.test(await pilot.innerText()));
 await shot('03-guide-step3');
 // 案内内の3D → 戻る
 await pilot.getByRole('button',{name:'3Dで位置を見る'}).click();await wait(webgl?2500:800);const loc=dlg('repair-location-sheet');ex('U5 案内内の3D（エアクリーナ）が開く',await loc.count()===1&&/エアクリーナ/.test(await loc.innerText()));
 if(webgl)ex('U5 案内内3Dにcanvasがある',await loc.locator('canvas').count()===1);
 await loc.getByRole('button',{name:'案内に戻る'}).click();await wait(300);ex('U5 3Dから戻っても案内位置を保持',await pilot.count()===1&&/3 \/ 3/.test(await pilot.innerText()));
 // 記録フェーズ（未実施・相談）
 await pilot.getByRole('button',{name:'確認結果を記録'}).click();await wait(200);ex('U3 記録1/3 目視の質問',/詰まりは見えますか/.test(await pilot.innerText()));
 ex('U3 目視未選択では次へ無効',await pilot.getByRole('button',{name:'次へ'}).isDisabled());
 await pilot.getByRole('button',{name:'確認できない・未確認'}).click();await pilot.getByRole('button',{name:'次へ'}).click();await wait(200);
 ex('U3 安全条件を確認済みなので「実施した」が押せる',!(await pilot.getByRole('button',{name:'実施した',exact:true}).isDisabled()));
 await pilot.getByRole('button',{name:'実施していない'}).click();await pilot.getByRole('button',{name:'次へ'}).click();await wait(200);
 const resultChoices=await pilot.locator('.repair-guide-choices button').allInnerTexts();ex('U3 未実施のとき結果は未確認/相談のみ',resultChoices.length===2&&resultChoices.every(t=>/再確認していない|相談/.test(t)),resultChoices);
 await pilot.getByRole('button',{name:'作業を進めず相談する'}).click();await pilot.getByRole('button',{name:'記録案を確認'}).click();await wait(200);
 ex('U3 確認画面で対象は機械全体のまま',/機械全体/.test(await pilot.innerText()));
 ex('U3 確認前は追記ボタン無効',await pilot.getByRole('button',{name:'記録へ追記'}).isDisabled());
 await pilot.locator('.repair-guide-check input').last().check();await pilot.getByRole('button',{name:'記録へ追記'}).click();await wait(1200);
 let r2=await rec(id);const heading=`SKP-101W：エンジンの出力が低下する（${new Date().toISOString().slice(0,10)}）`;
 ex('U3 未確認・相談を記録（追記1回・出典3件・対象保持）',await pilot.count()===0&&r2.meta.action.startsWith(heading)&&/相談する/.test(r2.meta.result)&&r2.meta.sources.length===3&&r2.meta.machineRef.partId==='machine',{action:r2.meta.action.slice(0,80),sources:r2.meta.sources.length});
 await shot('04-after-guide');
 // 安全未確認では実施済みにできない（新しい案内、スキップ経路）
 await page.getByRole('button',{name:'症状を確認する'}).click();await wait(500);await pilot.getByRole('button',{name:'作業せず、未確認・相談を記録'}).click();await wait(200);await pilot.getByRole('button',{name:'確認できない・未確認'}).click();await pilot.getByRole('button',{name:'次へ'}).click();await wait(200);
 ex('Q2 安全条件未確認では「実施した」を選べない',await pilot.getByRole('button',{name:'実施した',exact:true}).isDisabled());
 await pilot.getByRole('button',{name:'閉じる'}).last().click().catch(async()=>{await pilot.getByRole('button',{name:'前へ'}).click();await pilot.getByRole('button',{name:'前へ'}).click();await pilot.getByRole('button',{name:'閉じる'}).first().click();});await wait(300);
 if(await pilot.count()){await page.keyboard.press('Escape');await wait(300);}
 // U4: 部品を選ぶ→保存→一覧→再表示→再読込、分解の動き
 await page.getByRole('button',{name:'部品を選ぶ'}).click();await wait(webgl?2000:800);const picker=dlg('machine-picker');await picker.getByRole('button',{name:/中を見る/}).first().click();await wait(300);await picker.getByRole('button',{name:'エアクリーナ',exact:true}).click();await picker.getByRole('button',{name:/この部品を対象にする/}).click();await wait(1000);
 let r3=await rec(id);ex('U4 対象部品をエアクリーナに変更して保存',r3.meta.machineRef.partId==='aircleaner');
 await page.goto(base+'#/repairs');await wait(800);await page.locator('a.repair-history-row').first().click();await wait(800);await page.reload();await wait(1500);
 const headName=await page.locator('.repair-machine-heading strong').textContent();ex('U4 再読込後に機種・版・部品名を復元',headName==='エアクリーナ'&&(await rec(id)).meta.machineRef.modelVersion==='skp-101w@daf7afab',headName);
 if(webgl){await page.waitForSelector('.repair-machine-canvas canvas',{timeout:30000});const canvas=page.locator('.repair-machine-canvas');const sawPlaying=await page.waitForFunction(()=>document.querySelectorAll('.repair-machine-tools button')[1]?.textContent==='もう一度',null,{timeout:4000}).then(()=>true).catch(()=>false);const btnDuring=sawPlaying?'もう一度':await page.locator('.repair-machine-tools button').nth(1).textContent();
  const frames=[];frames.push(sha(await canvas.screenshot()));await wait(450);frames.push(sha(await canvas.screenshot()));await wait(700);frames.push(sha(await canvas.screenshot()));await wait(2000);const btnAfter=await page.locator('.repair-machine-tools button').nth(1).textContent();frames.push(sha(await canvas.screenshot()));
  ex('U4 全体→中間→部品の描画が実際に変化（3時点のハッシュが異なる）',new Set(frames).size>=3,frames);
  ex('U4 再生中は「もう一度」、終了後は「部品へ」',btnDuring==='もう一度'&&btnAfter==='部品へ',{btnDuring,btnAfter});
  await canvas.screenshot({path:path.join(out,`${run}-05-anim-end.png`)});
  await page.locator('.repair-machine-tools button').nth(1).click();await wait(300);const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+40,box.y+box.height/2+10,{steps:5});await page.mouse.up();await wait(300);
  ex('U4 途中操作で再生が止まる',(await page.locator('.repair-machine-tools button').nth(1).textContent())==='部品へ');
  await page.locator('.repair-machine-tools button').nth(1).click();await wait(3000);ex('U4 「部品へ」で再度再生できる',(await page.locator('.repair-machine-tools button').nth(1).textContent())==='部品へ');
  ex('U4 再生・操作で保存対象が変わらない',(await rec(id)).meta.machineRef.partId==='aircleaner');}
 else ex('U4 WebGL無効：3D失敗の表示と再表示ボタン',/表示できません|再表示/.test(await page.locator('.repair-machine-canvas').innerText()));
 await shot('06-detail-aircleaner');
 // U5: 詳細→案内→3D→案内→詳細、部品選択の開閉後に3Dが戻る
 await page.getByRole('button',{name:'症状を確認する'}).click().catch(()=>{});await wait(400);
 if(await pilot.count()){await pilot.getByRole('button',{name:'3Dで位置を見る'}).click();await wait(webgl?1500:500);await dlg('repair-location-sheet').getByRole('button',{name:'案内に戻る'}).click();await wait(300);await pilot.getByRole('button',{name:'閉じる'}).first().click();await wait(webgl?2500:500);}
 ex('U5 案内を閉じた後、詳細のcanvasは1つで対象はエアクリーナ',(!webgl||await page.locator('canvas').count()===1)&&(await page.locator('.repair-machine-heading strong').textContent())==='エアクリーナ',{canvases:await page.locator('canvas').count()});
 await page.getByRole('button',{name:'部品を選ぶ'}).click();await wait(webgl?1500:500);await dlg('machine-picker').getByRole('button',{name:'閉じる'}).first().click();await wait(webgl?2500:500);
 ex('U5 部品選択を閉じても3Dが戻り対象不変',(!webgl||await page.locator('.repair-machine-canvas canvas').count()===1)&&(await rec(id)).meta.machineRef.partId==='aircleaner');
 // U6: 結果の保存失敗 → 訂正 → 復旧 → 1回だけ
 const before=await rec(id);const inject=()=>page.evaluate(()=>{window.__si=window.__si||Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('quota');};});const restore=()=>page.evaluate(()=>{if(window.__si)Storage.prototype.setItem=window.__si;});
 await page.getByRole('button',{name:'結果を残す'}).click();await wait(300);const note=dlg('repair-note-sheet');await note.getByLabel('行ったこと').fill('案A：エレメントを外した');await note.getByRole('button',{name:'内容を確認'}).click();await wait(200);await inject();await note.getByRole('button',{name:'保存する'}).click();await wait(800);
 ex('U6 保存失敗を成功表示しない（ダイアログ残存・警告）',await note.count()===1&&/保存できません/.test(await note.locator('[role=alert]').innerText().catch(()=>'')));
 await note.getByRole('button',{name:'戻る'}).click();await wait(200);ex('U6 失敗後も入力を保持',(await note.getByLabel('行ったこと').inputValue())==='案A：エレメントを外した');
 await note.getByLabel('行ったこと').fill("案A′：エレメントを外して乾いたほこりを払った");await note.getByRole('button',{name:'内容を確認'}).click();await wait(200);await restore();await note.getByRole('button',{name:'保存する'}).click();await wait(1000);
 let r4=await rec(id);const addedA=(r4.meta.action.match(/案A：/g)||[]).length,addedA2=(r4.meta.action.match(/案A′：/g)||[]).length;
 ex('U6 復旧後は最終案A′だけが1回追記され、既存文章・出典を保持',await note.count()===0&&addedA===0&&addedA2===1&&r4.meta.action.startsWith(before.meta.action)&&r4.meta.sources.length===before.meta.sources.length,{addedA,addedA2});
 await page.reload();await wait(1200);r4=await rec(id);ex('U6 再読込後も1回だけ',(r4.meta.action.match(/案A′：/g)||[]).length===1);
 // U6b: 同じ案の再送（同一ダイアログ内）
 await page.getByRole('button',{name:'結果を残す'}).click();await wait(300);await note.getByLabel('確認した結果').fill('案B：再始動して確認');await note.getByRole('button',{name:'内容を確認'}).click();await wait(200);await inject();await note.getByRole('button',{name:'保存する'}).click();await wait(600);await restore();await note.getByRole('button',{name:'保存する'}).click();await wait(1000);
 const r5=await rec(id);ex('U6 同じ案の再送は重複しない',await note.count()===0&&(r5.meta.result.match(/案B：/g)||[]).length===1,(r5.meta.result.match(/案B：/g)||[]).length);
 // U7: 案内追記の保存失敗（対象をエアクリーナ以外→変更チェック）
 await page.getByRole('button',{name:'部品を選ぶ'}).click();await wait(webgl?1500:500);await dlg('machine-picker').getByRole('button',{name:/機械全体を対象にする/}).click();await dlg('machine-picker').getByRole('button',{name:/この部品を対象にする/}).click();await wait(1000);
 ex('U7 前提：対象を機械全体へ戻した',(await rec(id)).meta.machineRef.partId==='machine');
 await page.getByRole('button',{name:'症状を確認する'}).click();await wait(500);await pilot.getByRole('button',{name:'作業せず、未確認・相談を記録'}).click();await wait(150);await pilot.getByRole('button',{name:'見える範囲では見当たらない'}).click();await pilot.getByRole('button',{name:'次へ'}).click();await wait(150);await pilot.getByRole('button',{name:'実施していない'}).click();await pilot.getByRole('button',{name:'次へ'}).click();await wait(150);await pilot.getByRole('button',{name:'再確認していない・判断できない'}).click();await pilot.getByRole('button',{name:'記録案を確認'}).click();await wait(200);
 await pilot.locator('.repair-guide-check input').first().check();await pilot.locator('.repair-guide-check input').last().check();await inject();await pilot.getByRole('button',{name:'記録へ追記'}).click();await wait(800);
 ex('U7 案内追記の保存失敗を表示し、案内を保持',await pilot.count()===1&&/保存を確認できません/.test(await pilot.locator('[role=alert]').innerText().catch(()=>'')));
 // 回答訂正して再送
 await pilot.getByRole('button',{name:'前へ'}).click();await wait(150);await pilot.getByLabel(/未確認の点・相談内容/).fill('販売店に相談する');await pilot.getByRole('button',{name:'記録案を確認'}).click();await wait(150);await pilot.locator('.repair-guide-check input').first().check();await pilot.locator('.repair-guide-check input').last().check();await restore();await pilot.getByRole('button',{name:'記録へ追記'}).click();await wait(1200);
 const r6=await rec(id);const n6=(r6.meta.result.match(/見える範囲では詰まりが見当たらない/g)||[]).length;
 ex('U7 復旧後は最終案が1回、対象はエアクリーナ、出典3件のまま',await pilot.count()===0&&n6===1&&/販売店に相談する/.test(r6.meta.result)&&r6.meta.machineRef.partId==='aircleaner'&&r6.meta.sources.length===3,{n6,partId:r6.meta.machineRef.partId});
 await shot('07-after-u7');
 // U8: 記録の詳細・公開管理
 await page.getByRole('button',{name:'その他'}).click();await wait(300);await page.getByRole('button',{name:'記録の詳細'}).click();await wait(300);const info=(await page.getByRole('dialog',{name:'記録の詳細'}).innerText().catch(async()=>await page.locator('dialog[open]').last().innerText())).replace(/\s+/g,' ');
 ex('U8 記録の詳細に機械・対象部品・出典・実施・結果',/機械/.test(info)&&/対象部品/.test(info)&&/出典/.test(info)&&/実施したこと/.test(info)&&/結果/.test(info));
 await page.keyboard.press('Escape');await wait(200);await page.getByRole('button',{name:'その他'}).click().catch(()=>{});await wait(200);await page.getByRole('button',{name:'公開・記録管理'}).click();await wait(300);const mg=(await page.locator('dialog[open]').last().innerText()).replace(/\s+/g,' ');
 ex('U8 公開管理の入口（非公開表示・公開内容確認・削除）に到達',/非公開|公開状態を確認できません/.test(mg)&&/公開する内容を確認|公開状態を再確認/.test(mg)&&/記録を削除/.test(mg),mg.slice(0,120));
 await shot('08-management');await page.keyboard.press('Escape');await wait(200);
 // U9: 未知の機種・版・部品
 const store=await recs();const uids={};const mk=(suffix,ref)=>{uids[suffix]=crypto.randomUUID();return {...structuredClone(store.records.find(x=>x.id===id)),id:uids[suffix],title:'未知'+suffix,meta:{...structuredClone(store.records.find(x=>x.id===id).meta),machineRef:ref,action:'',result:'',issue:''}};};
 const unknowns=[mk('mach',{machineId:'yanmar-x1',modelVersion:'v1',partId:'machine'}),mk('ver',{machineId:'skp-101w',modelVersion:'skp-101w@00000000',partId:'machine'}),mk('part',{machineId:'skp-101w',modelVersion:'skp-101w@daf7afab',partId:'no-such-part'})];
 await page.evaluate(([key,recsAll])=>{const d=JSON.parse(localStorage.getItem(key));d.records=[...recsAll,...d.records];localStorage.setItem(key,JSON.stringify(d));},[store.key,unknowns]);
 await page.goto(base+'#/repairs');await page.reload();await wait(1500);const listText=(await page.locator('.repair-history-list').innerText()).replace(/\s+/g,' ');
 ex('U9 一覧で未知機種・版・部品を確認不能として表示（SKP代用なし）',/未知mach/.test(listText)&&(listText.match(/対象部品を確認できません/g)||[]).length>=2,listText.slice(0,200));
 const u9={};for(const [s,expect] of [['mach',/この機種の3Dは未対応/],['ver',/表示できません/],['part',/表示できません/]]){await page.goto(base+'#/repair/'+uids[s]);await page.reload();await wait(1500);const hasView=await page.locator('.repair-machine-canvas').count();const t=(hasView?await page.locator('.repair-machine-canvas').innerText():'NO-VIEW: '+(await page.locator('body').innerText()).slice(0,400)).replace(/\s+/g,' ');const r=await rec(uids[s]);u9[s]={text:t.slice(0,300),ref:r&&r.meta.machineRef,label:hasView?(await page.locator('.repair-target-row').innerText()).slice(0,30):null,pageErrors:report.runs[run].errors.slice(-3)};await shot('09-unknown-'+s);ex(`U9 ${s}：3Dを代用せず未対応を明示・参照不変`,expect.test(t)&&r&&['machineId','modelVersion','partId'].every(k=>r.meta.machineRef[k]===unknowns.find(u=>u.id===uids[s]).meta.machineRef[k])&&/対象部品を確認できません/.test(u9[s].label||''),u9[s]);}
 await shot('09-unknown-machine');
 report.runs[run].external=[...new Set(report.runs[run].external)];await ctx.close();
}
async function envDiff(browser){
 // 1280px：主要画面を1回ずつ表示
 {const {ctx,page,shot,rec,recs}=await setup(browser,'1280',{viewport:{width:1280,height:1000}});await page.goto(base+'#/repairs');await page.waitForTimeout(1200);if(await page.locator('dialog.repair-intro').count())await page.locator('dialog.repair-intro').getByRole('button',{name:'スキップ'}).click();
  const ov=async n=>ex(`1280 ${n}：横はみ出しなし`,!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)));await ov('一覧');await shot('10-list');
  await page.getByRole('button',{name:'修理をはじめる'}).first().click();await page.waitForTimeout(2500);await ov('詳細');await shot('11-detail');
  await page.getByRole('button',{name:'症状を確認する'}).click();await page.waitForTimeout(500);await ov('案内');const w=await page.locator('dialog.repair-pilot').boundingBox();ex('1280 案内ダイアログの幅が極端に細くない',w&&w.width>=480,w);await shot('12-guide');await page.locator('dialog.repair-pilot').getByRole('button',{name:'閉じる'}).first().click();await page.waitForTimeout(300);
  await page.getByRole('button',{name:'結果を残す'}).click();await page.waitForTimeout(300);await ov('結果入力');await shot('13-result');await page.keyboard.press('Escape');await page.waitForTimeout(200);
  await page.getByRole('button',{name:'その他'}).click();await page.waitForTimeout(200);await page.getByRole('button',{name:'記録の詳細'}).click();await page.waitForTimeout(300);await ov('記録詳細');await shot('14-record-info');report.runs['1280'].external=[...new Set(report.runs['1280'].external)];await ctx.close();}
 // 動きを減らす設定
 {const {ctx,page,shot,rec}=await setup(browser,'reduced-motion',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await page.goto(base+'#/repairs');await page.waitForTimeout(1000);if(await page.locator('dialog.repair-intro').count())await page.locator('dialog.repair-intro').getByRole('button',{name:'スキップ'}).click();
  await page.getByRole('button',{name:'修理をはじめる'}).first().click();await page.waitForTimeout(1500);const id=(page.url().match(/#\/repair\/([^/?]+)/)||[])[1];
  await page.getByRole('button',{name:'部品を選ぶ'}).click();await page.waitForTimeout(1500);const picker=page.locator('dialog.machine-picker');await picker.getByRole('button',{name:/中を見る/}).first().click();await picker.getByRole('button',{name:'エアクリーナ',exact:true}).click();await picker.getByRole('button',{name:/この部品を対象にする/}).click();await page.waitForTimeout(500);
  await page.reload();await page.waitForTimeout(600);await page.waitForSelector('.repair-machine-canvas canvas',{timeout:30000});const btn=await page.locator('.repair-machine-tools button').nth(1).textContent();const early=sha(await page.locator('.repair-machine-canvas').screenshot());await page.waitForTimeout(1500);const late=sha(await page.locator('.repair-machine-canvas').screenshot());
  ex('reduced-motion 途中演出なしで直ちに部品表示（再生状態にならず、描画が安定）',btn==='部品へ'&&early===late&&(await rec(id)).meta.machineRef.partId==='aircleaner',{btn,early,late});await shot('15-reduced');report.runs['reduced-motion'].external=[...new Set(report.runs['reduced-motion'].external)];await ctx.close();}
}
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));global.base='http://127.0.0.1:'+srv.address().port+'/';
 let b=await chromium.launch({headless:true,executablePath:process.env.ATLAS_CHROMIUM_PATH,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 await fullFlow(b,'390-touch',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});await envDiff(b);await b.close();
 b=await chromium.launch({headless:true,executablePath:process.env.ATLAS_CHROMIUM_PATH,args:['--no-sandbox','--disable-3d-apis']});
 await fullFlow(b,'390-noWebGL',{viewport:{width:390,height:844},isMobile:true,hasTouch:true},{webgl:false});await b.close();
 report.summary=Object.fromEntries(Object.entries(report.runs).map(([k,v])=>[k,{passed:v.checks.filter(c=>c.ok).length,failed:v.checks.filter(c=>!c.ok).length,errors:v.errors.slice(0,5),external:v.external}]));report.checkedAt=new Date().toISOString();report.base='main 370e838 + candidate.patch (Nitoron-Repair-UX-2026-09-13) + save-status fix in src/main.jsx, local vite build';
 fs.writeFileSync(path.join(out,'repair-ux-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary,null,1));srv.close();})().catch(e=>{console.error(e);fs.writeFileSync(path.join(out,'repair-ux-check.partial.json'),JSON.stringify(report,null,2));srv.close();process.exit(1);});
