import {ExteriorWorkspace} from './cowling-bridge.mjs';
import {refOf} from './catalog.mjs';
import {loftDimensions} from './arched-loft.mjs';
import {cowlingRecipe,makeCowlingVariant,COWLING_SLOT} from './cowling-recipes.mjs';

export function installExteriorUI(api){
 const w=new ExteriorWorkspace(api.assembly,p=>api.applyPartPackage(p));
 const $=s=>document.querySelector(s),selector=$('#exterior-asset');
 const message=s=>$('#exterior-status').textContent=s;
 function readStorage(){return localStorage;}
 function save(){try{return w.save(readStorage());}catch{return{saved:false,message:'端末へ保存できません。JSONを書き出してください。'};}}
 function notify(text){const r=save();message(r.saved?text+' 端末へ保存しました。':'変更はこの画面にあります。'+r.message);}
 function options(selected=selector.value){
  selector.replaceChildren();for(const r of w.catalog.list().filter(x=>x.family==='archedLoft')){const o=document.createElement('option');o.value=refOf(r);o.textContent=r.label+' / '+r.revision;selector.append(o);}
  if([...selector.options].some(o=>o.value===selected))selector.value=selected;
  describe();
 }
 function describe(){
  const r=w.catalog.get(selector.value),d=loftDimensions(r.params);
  $('#exterior-dimensions').textContent=`保存した形状：長さ ${d.length.toFixed(1)} × 幅 ${d.width.toFixed(1)} × 高さ ${d.height.toFixed(1)} mm`;
  for(const k of ['length','width','height'])$('#exterior-'+k).value=Number(d[k].toFixed(3));$('#exterior-crown').value='1';
  $('#exterior-applied').textContent=w.activeRef?'取付中：'+w.activeRef:'取付中：既存形状、または形状JSONからの更新';
  $('#exterior-count').textContent=`保存 ${w.catalog.list().length}版 / 曲面 ${w.catalog.list().filter(x=>x.family==='archedLoft').length}版`;
 }
 function apply(ref=selector.value){w.apply(ref);describe();notify('カバーを交換しました。視点・選択・分解・透過は維持しています。');}
 selector.onchange=describe;
 $('#exterior-apply').onclick=()=>{try{apply();}catch(e){message('交換しませんでした：'+e.message);}};
 $('#exterior-inspect').onclick=()=>{api.selectGroup('engine');api.selectElement(COWLING_SLOT);$('#detail-scene').scrollIntoView({block:'center'});};
 $('#exterior-create').onclick=()=>{
  try{
   const config=Object.fromEntries(['length','width','height','crown'].map(k=>[k,Number($('#exterior-'+k).value)]));
   const refs=new Set(w.catalog.list().map(refOf));let n=1;while(refs.has(cowlingRecipe().key+'@variant-'+n))n++;
   const r=makeCowlingVariant(cowlingRecipe(),config,'variant-'+n);w.catalog.add(r);options(refOf(r));notify('寸法違いを別版として保存しました。機械にはまだ反映していません。');
  }catch(e){message('作成しませんでした：'+e.message);}
 };
 function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 $('#exterior-export').onclick=()=>download(w.serialize(),'nitoron-exterior-library.json');
 $('#exterior-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1024*1024)throw Error('1MiB以内のJSONを選んでください');w.import(await file.text());options(w.activeRef||selector.value);notify('保存レシピと取付先を読み込みました。');}catch(err){message('読み込みませんでした：'+err.message);}finally{e.target.value='';}};
 $('#exterior-save').onclick=()=>{notify('現在の部品庫を保存しました。');describe();};
 try{const r=w.restore(readStorage());options(w.activeRef||refOf(cowlingRecipe()));message(r.error?'保存データを復元できませんでした：'+r.error:r.restored?'保存した外装版を復元しました。':'元の形状を部品庫から再現しています。');}catch(e){options(refOf(cowlingRecipe()));message('端末の保存領域を使用できません。JSON書き出しを使えます。');}
 window.addEventListener('pc752n-geometry-changed',()=>{if(selector.options.length)describe();});
 api.exterior={workspace:w,apply,describe,get selectedRef(){return selector.value;}};
 return w;
}
