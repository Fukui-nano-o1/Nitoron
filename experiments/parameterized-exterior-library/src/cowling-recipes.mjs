import {LOFT_GENERATOR,configuredLoft} from './arched-loft.mjs';
import {validateRecipe} from './catalog.mjs';
// Transcribed ONCE from the existing human-authored PC752N candidate, not newly measured.
export const COWLING_SLOT='pc752n/engine/orange-cowling/001';
export const COWLING_ANCHOR=Object.freeze([-663,601,0]);
export const COWLING_RECIPE=Object.freeze({
 key:'exterior/pc752n/cowling',revision:'baseline-1',label:'PC752N 上部カバー・既存形状',family:'archedLoft',generator:LOFT_GENERATOR,units:'mm',material:'orange',
 params:{steps:20,sections:[[0,9,19,80],[38,4,72,132],[112,0,102,144],[209,0,107,143],[297,3,78,122],[324,8,34,96]]},
 sources:[{reference:'baseline/model.mjs / orange-cowling',page:'',sha256:'',note:'既存の公式写真参照・人手作成モデルを転記。個別寸法・裏側・板厚は未確認。メーカーCADではありません。'}]
});
export function cowlingRecipe(){return validateRecipe(COWLING_RECIPE);}
export function makeCowlingVariant(base,config,revision){
 const r=validateRecipe(base);if(r.family!=='archedLoft')throw Error('曲面レシピを選択してください');
 return validateRecipe({...r,revision,label:'上部カバー・寸法違い '+revision,params:configuredLoft(r.params,config),sources:[...r.sources,{reference:r.key+'@'+r.revision,page:'',sha256:'',note:'開発用の寸法・断面変更。新機種・実機との適合は未確認。'}]});
}
