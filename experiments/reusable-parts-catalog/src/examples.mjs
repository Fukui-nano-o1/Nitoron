import {VERSION} from './catalog.mjs';
const common={revision:'1',units:'mm',generator:VERSION,material:'steel',sources:[{reference:'Nitoron procedural demonstration',page:'',sha256:'',note:'形状再利用の検証用寸法。実機採用品・規格適合の確認なし。'}]};
export const EXAMPLES=[
 {...common,key:'example/bolt/d8-l30',label:'六角ボルト例：径8・首下30',family:'bolt',params:{diameter:8,length:30,headAcrossFlats:13,headHeight:5.3,pitch:1.25,threadDepth:.65}},
 {...common,key:'example/nut/a13',label:'六角ナット例：二面幅13',family:'nut',params:{acrossFlats:13,height:6.5,bore:7}},
 {...common,key:'example/washer/o16',label:'座金例：外径16・内径8.4',family:'washer',params:{outer:16,inner:8.4,thickness:1.6}},
 {...common,key:'example/cable/d5',label:'ケーブル例：外径5',family:'cable',material:'black',params:{diameter:5}},
 {...common,key:'example/panel/w60',label:'リブ付きパネル例：幅60',family:'ribbedPanel',material:'orange',params:{width:60,height:40,thickness:3,ribCount:7,ribHeight:9,ribWidth:2}},
];
export const ROUTES={A:[[-30,0,0],[-15,20,10],[15,26,10],[35,10,-10]],B:[[-30,0,0],[-20,-15,15],[10,-10,15],[35,10,-10]]};
