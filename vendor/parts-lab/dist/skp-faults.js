import {pageLink} from './skp-parts.js';
// These are documented conditions, not measured failure frequencies.
export const FAULTS=[
 {name:'エアクリーナの目詰まり',symptom:'エンジンの出力が低下する',parts:['aircleaner','engine'],focus:'aircleaner__element',page:74,guide:'power',text:'ほこりの詰まりが出力低下につながる場合があります。カバーとエレメントの確認は、停止・冷却後に説明書を参照してください。'},
 {name:'植付カップ内の詰まり',symptom:'苗が落ちない・詰まる',parts:['cup','soilrubberF','soilrubberR'],focus:'cup',page:54,guide:'missing',text:'泥や根の詰まりを確認する候補です。苗の状態など、機械の故障以外の原因もあります。'},
 {name:'苗取出し爪の変形・摩耗',symptom:'苗を正常に取り出せない',parts:['picker','pickerdrive'],focus:'picker',page:86,guide:'missing',text:'爪の状態を確認します。位置や作動タイミングの調整は購入先に相談してください。'},
 {name:'車輪取付ピンの不足',symptom:'株間がばらつく',parts:['rearL','rearR','transmission'],focus:'rearL__fasteners',page:54,guide:'spacing',text:'取付部は確認候補の一つです。モデルの締結部品は模式表示で、実機のピン形状・本数を示しません。'},
 {name:'駆動ベルト・チェーンの異常',symptom:'株間がばらつく',parts:['transmission','drivecase'],focus:'transmission__belt',page:54,guide:'spacing',text:'駆動部の確認候補です。ベルトやチェーンの調整方法は説明書と購入先に確認してください。'},
 {name:'整地ローラの接地不足',symptom:'植付深さがばらつく',parts:['roller','cup'],focus:'roller',page:56,guide:'depth',text:'うねとの接地状態を確認します。ほ場の凹凸、残さ、苗の状態も関係するため、部品故障とは断定できません。'}
].map((fault,i)=>({...fault,id:'condition-'+i,source:pageLink(fault.page)}));
