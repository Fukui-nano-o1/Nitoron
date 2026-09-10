export const SOURCE_ROOT = 'https://agriculture.kubota.co.jp/after-support/self-maintenance/tractor/';
export const SOURCE_DATE = '2026-09-09';
export const PARTS = [
 {id:'hood',name:'ボンネット',category:'外装・運転席',description:'エンジン上部を覆う外装。分解表示で持ち上げると、内部の配置を確認できます。',shell:true},
 {id:'grille',name:'フロントグリル',category:'外装・運転席',description:'前面の外装と通風部。背後にラジエータがあります。',shell:true},
 {id:'fenderL',name:'左リヤフェンダ',category:'外装・運転席',description:'左後輪上部を覆う外装です。',shell:true},
 {id:'fenderR',name:'右リヤフェンダ',category:'外装・運転席',description:'右後輪上部を覆う外装です。',shell:true},
 {id:'seat',name:'シート',category:'外装・運転席',description:'運転席の座面と背もたれ。下部の支持構造を簡略化して表しています。'},
 {id:'controls',name:'ステアリング・操作部',category:'外装・運転席',description:'ステアリング、メーター、操作レバーをまとめた構造モデルです。'},
 {id:'rops',name:'安全フレーム',category:'外装・運転席',description:'運転席を囲む保護構造の模式表現。強度や実機の取付構造は再現していません。'},
 {id:'canopy',name:'キャノピー',category:'外装・運転席',description:'運転席上部の日よけ。画面上では安全フレームから離して確認できます。',shell:true},
 {id:'engine',name:'ディーゼルエンジン',category:'エンジン・冷却・電装',description:'動力源。3気筒を想定した外観モデルです。内部の燃焼室・ピストンは省略しています。'},
 {id:'radiator',name:'ラジエータ',category:'エンジン・冷却・電装',description:'冷却水の熱を空気に逃がす部分。前面の網やコアの汚れを点検する位置を示しています。',fact:'メーカーの一般点検項目に、ラジエータ周囲やスクリーンの清掃が含まれます。機種固有の故障頻度を示すものではありません。',source:'https://www.kubotausa.com/maintenance-schedules/kubota-maintenance-check-points'},
 {id:'belt',name:'ファンベルト・プーリー',category:'エンジン・冷却・電装',description:'エンジン前方のベルトと回転部の模式表現。調整量や張力は実機の取扱説明書で確認する必要があります。',fact:'ベルトの緩みは、オーバーヒートや充電不足の原因になり得ます。き裂やはがれがある場合は購入先に交換を相談するよう、メーカーが案内しています。',source:SOURCE_ROOT+'03.html'},
 {id:'battery',name:'バッテリ',category:'エンジン・冷却・電装',description:'始動時などに電力を供給します。極性を見分けるため、＋端子を赤で表しています。',fact:'消耗したバッテリは始動性低下の原因になり得ます。ただし、写真と症状だけでバッテリ故障と確定することはできません。',source:SOURCE_ROOT+'06.html'},
 {id:'airbox',name:'エアクリーナケース',category:'エンジン・冷却・電装',description:'吸気用フィルタを収納するケース。別部品のエレメントを内部に配置しています。',source:SOURCE_ROOT+'05.html'},
 {id:'filter',name:'エアクリーナエレメント',category:'エンジン・冷却・電装',description:'エンジンへ入る空気をろ過する部品。プリーツ状のろ材を模式的に再現しています。',fact:'メーカーは、エレメントの変形・目詰まりの点検を案内しています。変形や不適切な扱いは、エンジンへの異物侵入につながります。',source:SOURCE_ROOT+'05.html'},
 {id:'tank',name:'燃料タンク',category:'エンジン・冷却・電装',description:'燃料を保持する部分。実機の容量・配管・搭載位置を保証する形状ではありません。'},
 {id:'oilfilter',name:'エンジンオイルフィルタ',category:'エンジン・冷却・電装',description:'エンジンオイルをろ過する部品の模式表現。適合部品番号は型式確認後に照合します。'},
 {id:'exhaust',name:'排気管・マフラ',category:'エンジン・冷却・電装',description:'エンジンからの排気を導く部分。画面では縦型の排気管として表現しています。'},
 {id:'chassis',name:'車体フレーム・ステップ',category:'駆動系・足回り',description:'各部品を支える構造と乗降用ステップです。寸法・耐荷重を示す設計図ではありません。'},
 {id:'transmission',name:'トランスミッション',category:'駆動系・足回り',description:'エンジンの動力を走行系へ伝える部分。ケース外観を模式的に表しています。'},
 {id:'frontaxle',name:'フロントアクスル',category:'駆動系・足回り',description:'前輪を支える車軸部。内部のギヤ、シール、潤滑経路は省略しています。'},
 {id:'rearaxle',name:'リヤアクスル',category:'駆動系・足回り',description:'左右の後輪へ動力を伝える車軸部の外観モデルです。'},
 {id:'wheelFL',name:'左前輪',category:'駆動系・足回り',description:'農業用ラグタイヤとホイール。サイズ・空気圧は実機指定値を確認してください。'},
 {id:'wheelFR',name:'右前輪',category:'駆動系・足回り',description:'農業用ラグタイヤとホイール。大きい後輪に対し、前輪を小さく表現しています。'},
 {id:'wheelRL',name:'左後輪',category:'駆動系・足回り',description:'後輪のタイヤ、リム、ハブ、取付ボルトをまとめて表示しています。'},
 {id:'wheelRR',name:'右後輪',category:'駆動系・足回り',description:'後輪のタイヤ、リム、ハブ、取付ボルトをまとめて表示しています。'},
 {id:'hitch',name:'三点リンク・PTO周辺',category:'駆動系・足回り',description:'後部作業機の接続部を簡略化したモデルです。実機の連結手順や適合を示すものではありません。'}
].map((p,i)=>({...p,number:String(i+1).padStart(2,'0')}));

const safe = {title:'停止して、点検の準備',text:'平らな場所で駐車し、作業機を下ろしてエンジンを停止。キーを抜き、回転部の停止と十分な冷却を確認します。以下は位置と点検内容を示すデモです。',part:null,explode:0};
export const GUIDES = {
 power:{source:SOURCE_ROOT+'05.html',steps:[safe,
  {title:'吸気系の位置を確認',text:'外装を透過してエアクリーナの位置を示します。出力低下には複数の原因があり、この表示は吸気系の点検候補です。',part:'airbox',explode:.2,shell:true},
  {title:'エレメントの状態を見る',text:'メーカーの点検項目は、エレメントの変形や目詰まりの有無。画面ではケースとエレメントを離して示しています。実機の取り外し方は型式ごとに確認してください。',part:'filter',explode:.72,shell:true},
  {title:'状態に応じて清掃・交換へ',text:'変形したエレメントをたたいて直さないでください。適合品と清掃方法を取扱説明書で確認し、不明な場合は購入先へ相談します。復旧は取扱説明書に従い、異常が残る場合は診断を依頼してください。',part:'filter',explode:.3,shell:true}
 ]},
 heat:{source:SOURCE_ROOT+'03.html',steps:[safe,
  {title:'冷却系の位置を確認',text:'水温上昇の点検候補として、前面の通風部とラジエータを表示します。冷却水が熱い状態でラジエータキャップを開けないでください。',part:'radiator',explode:.25,shell:true},
  {title:'通風部の汚れを見る',text:'ラジエータ前面の網やコアに、草やちりが詰まっていないか確認する位置です。実機の取り外し・清掃は取扱説明書に従います。',part:'radiator',explode:.7,shell:true,source:'https://www.kubotausa.com/maintenance-schedules/kubota-maintenance-check-points'},
  {title:'ベルトの状態を確認',text:'停止状態で、き裂やはがれの有無を確認する位置です。ベルトの緩みも水温上昇の原因になり得ます。張力の規定値は型式ごとに確認し、損傷があれば購入先に交換を相談してください。',part:'belt',explode:.52,shell:true}
 ]},
 start:{source:SOURCE_ROOT+'06.html',steps:[safe,
  {title:'バッテリの位置を確認',text:'始動不良の点検候補として電源部を示します。バッテリの消耗は始動性に影響しますが、燃料系や始動条件など別の原因もあり、故障は確定できません。',part:'battery',explode:.35,shell:true},
  {title:'実機の種類と表示を確認',text:'補水不要タイプなど、種類によって点検方法が異なります。搭載バッテリの表示と取扱説明書を照合してください。写真だけで充電状態や内部劣化は判定できません。',part:'battery',explode:.8,shell:true},
  {title:'適合する手順で点検を依頼',text:'充電・端子の取り外しには、極性や火気などの注意があります。このデモは位置の説明までです。実機に対応する取扱説明書を確認し、不明な場合は購入先に相談してください。',part:'battery',explode:.3,shell:true}
 ]}
};
