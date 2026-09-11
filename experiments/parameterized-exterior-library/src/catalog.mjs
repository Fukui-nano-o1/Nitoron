import {LOFT_GENERATOR,validateLoft} from './arched-loft.mjs';
// Immutable part recipes. Geometry reuse is NOT evidence of machine compatibility.
export const FAMILIES=Object.freeze({bolt:'締結 / ボルト',nut:'締結 / ナット',washer:'締結 / 座金',cable:'配線 / ケーブル',ribbedPanel:'外装 / リブ付きパネル',archedLoft:'外装 / 断面曲面'});
export const VERSION='detail-generator-v1';
const shapes={bolt:['diameter','length','headAcrossFlats','headHeight','pitch','threadDepth'],nut:['acrossFlats','height','bore'],washer:['outer','inner','thickness'],cable:['diameter'],ribbedPanel:['width','height','thickness','ribCount','ribHeight','ribWidth']};
export const canonical=x=>JSON.stringify(sort(x));
function sort(x){if(Array.isArray(x))return x.map(sort);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])]));return x;}
function fail(message){throw new Error(message);}
function object(x,keys){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!keys.includes(k)))fail('未対応の形式・項目です');}
function string(x,max=200){return typeof x==='string'&&x.trim().length>0&&x.length<=max&&!/[\u0000-\u001f]/.test(x);}
export function validateRecipe(input){
 object(input,['key','revision','label','family','params','material','sources','units','generator']);
 if(!string(input.key,100)||!/^[-a-zA-Z0-9/_]+$/.test(input.key)||!string(input.revision,32)||!/^[-a-zA-Z0-9.]+$/.test(input.revision)||!string(input.label))fail('部品キー・版・名称が不正です');
 if(!Object.hasOwn(FAMILIES,input.family)||input.units!=='mm'||input.generator!==(input.family==='archedLoft'?LOFT_GENERATOR:VERSION))fail('分類・単位・生成方法が未対応です');
 const p=input.params,keys=shapes[input.family];if(input.family==='archedLoft')validateLoft(p);else{object(p,keys);for(const k of keys)if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<=0||p[k]>10000)fail('寸法は正のmm数値で指定してください');}
 if(input.family==='bolt'&&(p.headAcrossFlats<=p.diameter||p.threadDepth>=p.diameter/4||p.pitch>=p.length||p.length/p.pitch>250))fail('ボルト寸法・ねじ数が範囲外です');
 if(input.family==='nut'&&p.bore>=p.acrossFlats)fail('ナットの穴が外形以上です');
 if(input.family==='washer'&&p.inner>=p.outer)fail('座金の内径が外径以上です');
 if(input.family==='ribbedPanel'&&(!Number.isInteger(p.ribCount)||p.ribCount>100||p.ribWidth*p.ribCount>p.width))fail('リブの本数・幅が範囲外です');
 if(!['steel','black','orange'].includes(input.material))fail('材質表示が未対応です');
 if(!Array.isArray(input.sources)||input.sources.length>12)fail('出所の形式が不正です');
 for(const s of input.sources){object(s,['reference','page','sha256','note']);if(!string(s.reference,1000)||typeof s.page!=='string'||s.page.length>40||typeof s.sha256!=='string'||(s.sha256&&!/^[a-f0-9]{64}$/.test(s.sha256))||!string(s.note,1200))fail('出所・該当箇所・メモが不正です');}
 return JSON.parse(canonical(input));
}
export const refOf=r=>r.key+'@'+r.revision;
export class Catalog{
 #assets=new Map();
 add(input){const r=validateRecipe(input),ref=refOf(r),old=this.#assets.get(ref);if(old&&canonical(old)!==canonical(r))fail('同じ部品版は上書きできません。新しい版にしてください');if(!old&&this.#assets.size>=500)fail('カタログは500版までです');this.#assets.set(ref,r);return ref;}
 get(ref){const x=this.#assets.get(ref);if(!x)fail('部品版を確認できません');return structuredClone(x);}
 list(){return [...this.#assets.values()].sort((a,b)=>refOf(a).localeCompare(refOf(b),'en')).map(x=>structuredClone(x));}
 serialize(){return canonical({schemaVersion:1,assets:this.list()});}
 static parse(raw){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>1024*1024)fail('カタログは1MiB以内にしてください');let d;try{d=JSON.parse(raw);}catch{fail('JSONを読み取れません');}object(d,['schemaVersion','assets']);if(d.schemaVersion!==1||!Array.isArray(d.assets)||d.assets.length>500)fail('カタログの版・件数が不正です');const c=new Catalog();for(const a of d.assets)c.add(a);return c;}
}
export function saveCatalog(storage,key,catalog){try{storage.setItem(key,catalog.serialize());return {saved:true};}catch{return {saved:false,message:'端末へ保存できません。JSONを書き出してください。'};}}
