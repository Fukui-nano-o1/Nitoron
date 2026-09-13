export const MANUAL='https://agriculture.kubota.co.jp/after-support/manual/download.html?hash=95e6834d0a3d99e9ea8811855ae9229d';
export const NOTICE='https://agriculture.kubota.co.jp/after-support/manual/notice.html?hash=95e6834d0a3d99e9ea8811855ae9229d';
export const CATALOG='https://agriculture.kubota.co.jp/img_sys/catalog/7502001503.pdf';
export const PRODUCT='https://agriculture.kubota.co.jp/product/vegetable_equipment/transplant-SKP-101/02.html';
export const SPECS='https://agriculture.kubota.co.jp/img_sys/specifications/6a029e7ae94f2625c9bf438698c23fce/7-50-2-0015_spec.pdf';
export const pageLink=page=>MANUAL+'#page='+(page+18);
export const META={name:'SKP-101W',subtitle:'歩行型全自動野菜移植機 / 往復2条',note:'公式資料を参照した模式モデル',manualCode:'PH136-9151-5',date:'2026-09-09',catalogDate:'2024年9月',dimensions:[2.2,1.35,1.35],dimensionsLabel:'全長 2,200 / 全幅 1,350 / 全高 1,350 mm',download:'./skp-101w.glb'};

const row=(id,name,category,description,page,extra={})=>({id,name,category,description,page,source:pageLink(page),...extra});
export const PARTS=[
 row('bonnet','ボンネット','エンジン・前部','前部のエンジンを覆うカバー。',3,{shell:true}),
 row('headlamp','前照灯','エンジン・前部','前面に配置された照明。',14),
 row('engine','ガソリンエンジン','エンジン・前部','空冷式の動力源。内部形状は省略。',3,{reveal:true}),
 row('tank','燃料タンク','エンジン・前部','エンジン上側の燃料容器。',3,{reveal:true,fact:'仕様資料：燃料タンク容量 4.8 L。',source:SPECS}),
 row('aircleaner','エアクリーナ','エンジン・前部','吸気をろ過する部品。',74,{reveal:true}),
 row('muffler','マフラ','エンジン・前部','排気系。作業後は高温になる部分。',3,{reveal:true}),
 row('recoil','リコイルスタータ','エンジン・前部','ロープを引く始動装置。',6,{reveal:true}),
 row('trayrail','苗のせ台','苗送り・植付部','傾斜したトレイ供給部。',3),
 row('seedtray','セルトレイ・苗','苗送り・植付部','200穴トレイを例示。苗の形状はイメージ。',27,{exampleOnly:true,fact:'仕様資料の適応トレイ：128穴・200穴。',source:SPECS}),
 row('trayfeed','トレイ搬送部','苗送り・植付部','トレイを送るレールと横桟。',12,{reveal:true}),
 row('pickercover','苗取りカバー','苗送り・植付部','苗取出し部の保護カバー。',59,{shell:true}),
 row('picker','苗取出し爪','苗送り・植付部','苗を取り出す細い爪。',86,{reveal:true,fact:'変形・摩耗を点検。交換の要否は説明書と購入先に確認。'}),
 row('pickerdrive','苗取出し駆動部','苗送り・植付部','苗取出し機構のリンクを簡略表示。',4,{reveal:true}),
 row('cupcase','植付ケースカバー','苗送り・植付部','植付機構側面のカバー。',60,{shell:true}),
 row('cup','植付カップ','苗送り・植付部','苗を土へ導く縦開きのカップ。',39,{reveal:true}),
 row('soilrubberF','土落としゴム・前','苗送り・植付部','植付カップ周囲の土落とし部品。',85),
 row('soilrubberR','土落としゴム・後','苗送り・植付部','露地仕様の後側の土落とし部品。',85),
 row('roller','整地ローラ','苗送り・植付部','うね面との接地を確認するローラ。',56),
 row('pressL','左覆土ローラ','苗送り・植付部','植付部の後側にある覆土用ローラ。',4),
 row('pressR','右覆土ローラ','苗送り・植付部','左右で根鉢周囲を押さえる構成。',4),
 row('chassis','車体フレーム','走行・駆動部','各機構を支えるフレーム。',3),
 row('frontaxle','前車軸','走行・駆動部','左右の前輪を支える部分。',28),
 row('frontL','左前輪','走行・駆動部','W仕様の広い輪距を模式的に表示。',28),
 row('frontR','右前輪','走行・駆動部','前輪と支持部。',28),
 row('rearL','左後輪','走行・駆動部','ラグ付きの走行輪。',28),
 row('rearR','右後輪','走行・駆動部','ラグ付きの走行輪。',28),
 row('transmission','ミッション・駆動ベルト','走行・駆動部','外観と動力伝達の模式表示。',79,{reveal:true}),
 row('drivecase','植付カップ駆動チェーンケース','走行・駆動部','植付部へつながる駆動部のカバー。',3,{shell:true}),
 row('handle','運転ハンドル','操作・苗台・スタンド','後方から機体を操作するハンドル。',4),
 row('console','操作レバー・パネル','操作・苗台・スタンド','株間・植付深さなどの操作部。',5),
 row('spares','予備苗のせ台','操作・苗台・スタンド','W仕様の製品写真を参照した苗台配置。',13,{source:PRODUCT,fact:'左側から予備苗を補給するW仕様。台の細かな寸法は未確認。'}),
 row('frontstand','前スタンド・バンパ','操作・苗台・スタンド','前方の支持・保護部。',8),
 row('rearstand','後スタンド・空トレイ台','操作・苗台・スタンド','後方のスタンドと空トレイを置く部分。',13)
].map((p,i)=>({...p,number:String(i+1).padStart(2,'0')}));

const stop={title:'停止してから確認',text:'平坦な場所で駐車ブレーキを掛け、エンジンと回転部を停止。熱が冷めてから点検します。',part:null,explode:0,page:53};
const check=(title,text,part,page,question,yes,extra={})=>({title,text,part,page,question,yes,explode:.35,...extra});
export const GUIDES={
 power:{label:'エンジンの出力が低下する',hint:'吸気系の点検候補',source:pageLink(74),steps:[stop,
  check('外装を確認','吸気系の点検位置はボンネットの内側です。実機の外装の扱いは説明書に従ってください。','bonnet',58,'点検箇所を確認できる？','説明書に沿って吸気系を確認',{explode:.45}),
  check('エアクリーナを確認','ほこりの詰まりが出力低下につながる場合があります。エレメントの掃除方法は説明書を確認してください。','aircleaner',74,'ほこりやごみの詰まりが見える？','エアクリーナの清掃を検討',{shell:true,explode:.6})]},
 missing:{label:'苗が落ちない・詰まる',hint:'苗 → カップ → 爪',source:pageLink(54),steps:[stop,
  check('苗を確認','濡れた葉や大きすぎる苗も、送り不良の確認候補です。','seedtray',54,'葉の濡れ・苗の大きさが気になる？','苗の状態を見直す候補'),
  check('カップ内を確認','カップの泥・根の詰まり、土落とし部品を確認。掃除は停止状態で。','cup',54,'泥や根の詰まりが見える？','カップの清掃・土落とし部品の点検候補',{shell:true,explode:.6}),
  check('爪を確認','爪の変形・摩耗を確認。位置や作動タイミングの調整は購入先へ。','picker',86,'爪の変形や摩耗が見える？','苗取出し爪について購入先へ相談',{shell:true,explode:.55})]},
 spacing:{label:'株間がばらつく',hint:'ほ場 → 車輪 → 駆動部',source:pageLink(54),steps:[stop,
  check('ほ場を確認','傾斜やスリップを確認。表示株間と実測値を照合します。','rearR',54,'傾斜や車輪の滑りがある？','ほ場条件と実測株間の確認候補'),
  check('車輪を確認','車輪取付部を確認。ピンの不足があれば適合部品を購入先に照会。','rearL',54,'取付ピンの不足が見える？','車輪取付部を購入先へ相談',{explode:.65}),
  check('駆動部を確認','駆動ベルト・チェーンも確認対象。具体的な調整は原典へ。','transmission',54,'ベルトやチェーンに異常が見える？','駆動部の点検を購入先へ相談',{shell:true,explode:.55})]},
 depth:{label:'植付深さがばらつく',hint:'苗 → うね → ローラ',source:pageLink(56),steps:[stop,
  check('根鉢を確認','根鉢の崩れや乾燥を確認します。','seedtray',56,'根鉢が崩れる・乾燥している？','苗・根鉢の状態を見直す候補'),
  check('うねとカップを確認','凹凸・残さ、カップの詰まりを確認します。','cup',56,'凹凸・残さ・詰まりがある？','うね条件・カップ清掃の確認候補',{shell:true,explode:.55}),
  check('整地ローラを確認','うねへの接地状態を確認する位置です。','roller',56,'作業時に接地していなかった？','ローラ高さとゲージの確認候補',{explode:.45})]}
};
for(const guide of Object.values(GUIDES))for(const step of guide.steps)step.source=pageLink(step.page);
