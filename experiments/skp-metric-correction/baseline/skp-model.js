import * as T from './vendor/three.module.js';
import {PARTS,META,MANUAL,PRODUCT,SPECS} from './skp-parts.js';
import {geometryKit} from './skp-geometry.js';

export function createSKP(){
 const root=new T.Group();root.name='SKP_101W_reference_schematic';
 root.userData={model:'SKP-101W',kind:'Reference-based schematic, not OEM CAD',sourceDate:META.date,sources:[MANUAL,PRODUCT,SPECS],manual: META.manualCode,notes:'Shared manual illustrations are labelled SKP-101. W product photograph is used for the wide wheel layout and spare-tray arrangement. Individual dimensions, hidden geometry and timing are not verified.'};
 const {part,piece,mesh,box,softBox,cyl,ring,rod,tube,panel,bolt,mounted,hoodSurface,capsule,finish}=geometryKit(root,PARTS);
 const g=part('chassis',[.0,.40,0],[0,0,0]);
 for(const z of [-.24,.24]){box(g,[1.20,.055,.055],[.12,0,z],'black');rod(g,[-.45,0,z],[-.54,.37,z],.018,'ivory');}
 box(g,[.50,.08,.45],[.20,.08,0],'black');
 for(const x of [-.36,.25,.69])box(g,[.035,.055,.55],[x,0,0],'metal');
 for(const s of [-1,1]){tube(g,[[.63,.03,s*.22],[.42,.20,s*.27],[-.12,.25,s*.28],[-.47,.17,s*.31]],.014,'ivory');tube(g,[[.35,.16,s*.18],[.17,.13,s*.29],[-.14,-.05,s*.20],[-.39,.04,s*.19]],.009);}

 const bonnet=part('bonnet',[.57,.75,0],[.15,.57,0]);
 const hood=piece(bonnet,'shell','ボンネット外板',[0,.20,0]);hoodSurface(hood);
 for(const side of [-1,1]){const trim=piece(bonnet,side<0?'trim-a':'trim-b','側面形状（表示用の分割） '+(side<0?'A':'B'),[0,.02,side*.18]);panel(trim,[[-.35,-.105],[-.34,-.01],[-.22,.043],[.12,-.003],[.27,-.073],[.24,-.12]],.008,[0,0,side*.211],'teal',.002);
  for(let i=0;i<3;i++)tube(trim,[[-.29,-.027-i*.024,side*.22],[-.1,-.030-i*.023,side*.225],[.11,-.065-i*.019,side*.214],[.23,-.10-i*.010,side*.19]],.005,'black');
  tube(trim,[[-.28,.024,side*.218],[-.06,.016,side*.234],[.15,-.017,side*.221]],.004,'ivory');
 }
 const lamp=part('headlamp',[.867,.785,0],[.61,.22,0]);const lampMount=mounted(lamp,[0,0,0],.55);const housing=piece(lampMount,'housing','ランプ取付枠',[-.10,0,0]);softBox(housing,[.039,.069,.19],[0,0,0],'black',undefined,.013);const lens=piece(lampMount,'lens','ランプレンズ',[.13,0,0]);softBox(lens,[.014,.050,.161],[.024,0,0],'light',undefined,.006);const leds=piece(lampMount,'led','LEDユニット（模式）',[.06,.08,0]);for(let i=-2;i<=2;i++)softBox(leds,[.01,.027,.025],[.021,0,i*.03],'silver',undefined,.004);
 const tank=part('tank',[.49,.787,0],[.22,.28,-.43]);
 const vessel=piece(tank,'body','燃料タンク本体',[0,-.08,0]);softBox(vessel,[.43,.16,.32],[0,0,0],'black',undefined,.033);const cap=piece(tank,'cap','燃料タンクキャップ',[0,.17,0]);cyl(cap,.043,.026,[.02,.102,-.02],'black','y',.043,48);for(let i=0;i<16;i++){const a=i*Math.PI*2/16;softBox(cap,[.008,.019,.006],[.02+Math.cos(a)*.041,.103,-.02+Math.sin(a)*.041],'black',[0,-a,0]);}const hose=piece(tank,'hose','燃料ホース',[.15,-.04,-.12]);tube(hose,[[.1,-.09,-.08],[.17,-.20,-.12],[.06,-.28,-.14]],.009);
 const engine=part('engine',[.53,.535,0],[.29,.06,.47]);
 const crank=piece(engine,'crankcase','クランクケース外形',[.12,-.05,0]);softBox(crank,[.25,.23,.25],[0,0,0],'black',undefined,.038);cyl(crank,.126,.25,[.10,-.04,0],'metal','z');
 const cylinder=piece(engine,'cylinder','シリンダ・ヘッド外形',[-.13,.19,0]);const block=mounted(cylinder,[-.10,.13,0],.36);softBox(block,[.18,.20,.23],[0,0,0],'metal');for(let i=0;i<8;i++)box(block,[.22,.008,.26],[0,-.07+i*.021,0],'black');softBox(block,[.19,.055,.24],[0,.137,0],'silver');
 const plug=piece(engine,'plug','点火プラグ外形',[-.1,.32,0]);cyl(plug,.016,.06,[-.16,.30,.04],'ivory');const lead=piece(engine,'lead','点火ケーブル',[.04,.16,.17]);tube(lead,[[-.15,.33,.04],[-.12,.36,.09],[.09,.19,.18]],.006);
 for(const z of [-.19,.19])box(engine,[.40,.025,.07],[.015,-.157,z],'metal');
 const recoil=part('recoil',[.615,.51,.17],[.52,.13,.58]);
 const starterCover=piece(recoil,'cover','スタータカバー',[0,0,.17]);cyl(starterCover,.121,.059,[0,0,0],'black','z',.110,64);ring(starterCover,.101,.007,[0,0,.035],'black');cyl(starterCover,.039,.063,[0,0,0],'black','z');
 for(let i=0;i<14;i++){const a=i*Math.PI*2/14;softBox(starterCover,[.010,.037,.004],[Math.cos(a)*.074,Math.sin(a)*.074,.032],'metal',[0,0,a-Math.PI/2]);}
 const rope=piece(recoil,'rope','始動ロープ',[-.12,.07,0]);rod(rope,[-.05,.093,0],[-.13,.16,.01],.005);const grip=piece(recoil,'grip','スタータグリップ',[-.18,.14,0]);softBox(grip,[.064,.027,.030],[-.14,.166,.012],'black',undefined,.009);
 const air=part('aircleaner',[.35,.64,-.23],[.12,.22,-.70]);
 const airCover=piece(air,'cover','エアクリーナカバー',[0,0,-.18]);softBox(airCover,[.16,.205,.082],[0,0,0],'black');for(let i=0;i<7;i++)box(airCover,[.13,.006,.007],[0,-.075+i*.025,-.046],'metal');
 const element=piece(air,'element','エアクリーナエレメント',[0,.15,0]);box(element,[.13,.16,.025],[0,0,.025],'soil');
 const intake=piece(air,'intake','ケース・吸気接続部',[.13,0,.09]);const airCase=piece(intake,'case','エアクリーナケース',[0,.10,.05]);softBox(airCase,[.15,.19,.04],[0,0,.02],'black');const duct=piece(intake,'duct','吸気接続管',[.15,-.02,.07]);tube(duct,[[.02,-.105,0],[.12,-.16,.08],[.18,-.13,.13]],.022);
 const muffler=part('muffler',[.72,.59,-.22],[.62,.04,-.45]);softBox(muffler,[.12,.18,.11],[0,0,0],'black');for(let i=0;i<6;i++)for(let j=0;j<4;j++)cyl(muffler,.0035,.01,[.067,-.06+i*.025,-.037+j*.023],'silver','x',.0035,6);tube(muffler,[[0,-.1,0],[.035,-.14,.045],[.10,-.15,.06]],.015);

 const frontaxle=part('frontaxle',[.77,.21,0],[.4,.05,0]);
 box(frontaxle,[.045,.05,1.11],[0,0,0],'ivory');cyl(frontaxle,.035,.95,[.01,.07,0],'black','z');
 for(const s of [-1,1]){rod(frontaxle,[0,0,s*.46],[.015,-.01,s*.56],.022,'metal');box(frontaxle,[.095,.14,.026],[0,-.015,s*.55],'ivory');for(let i=0;i<5;i++)bolt(frontaxle,[.026,.01,s*(.30+i*.038)],'x',.009);}
 function wheel(id,x,y,z,r,width,rear,e){const g=part(id,[x,y,z],e);const profile=[[r*.52,-width*.5],[r*.85,-width*.49],[r*.96,-width*.32],[r,width*.1],[r*.94,width*.38],[r*.78,width*.51],[r*.52,width*.5]].map(p=>new T.Vector3(p[0],p[1],0));const tyreCurve=new T.CatmullRomCurve3(profile);const geo=new T.LatheGeometry(tyreCurve.getPoints(32).map(p=>new T.Vector2(p.x,p.y)),64);geo.rotateX(Math.PI/2);
  const tire=piece(g,'tire','タイヤ',[0,.08,-.23]),rim=piece(g,'rim','ホイール',[0,0,0]),hub=piece(g,'hub','ハブ',[0,.02,.20]),bolts=piece(g,'fasteners','取付部（締結部品の模式表示）',[0,.02,.36]);
  mesh(tire,geo,'tire');const rimCurve=new T.CatmullRomCurve3([[r*.15,-width*.34],[r*.43,-width*.37],[r*.61,-width*.30],[r*.64,-width*.20],[r*.64,width*.20],[r*.61,width*.30],[r*.43,width*.37],[r*.15,width*.34]].map(([x,y])=>new T.Vector3(x,y,0)));const rimGeo=new T.LatheGeometry(rimCurve.getPoints(24).map(p=>new T.Vector2(p.x,p.y)),64);rimGeo.rotateX(Math.PI/2);mesh(rim,rimGeo,'ivory');
  for(const side of [-1,1]){ring(rim,r*.52,.008,[0,0,side*width*.47],'silver');cyl(hub,r*.21,.024,[0,0,side*width*.54],'metal','z');for(let i=0;i<5;i++){const a=i*Math.PI*2/5,px=Math.sin(a)*r*.34,py=Math.cos(a)*r*.34,pz=side*width*.52;const fixing=piece(bolts,(side<0?'a':'b')+i,'締結セット '+(side<0?'A':'B')+(i+1)+'（例示）',[Math.sin(a)*.10,Math.cos(a)*.10,side*.08]);const screw=piece(fixing,'bolt','ボルト（形状・本数未確認）',[0,0,side*.065]);bolt(screw,[px,py,pz],'z',.009);cyl(screw,.005,.028,[px,py,pz-side*.017],'metal','z');const washer=piece(fixing,'washer','座金（例示）',[0,0,-side*.045]);ring(washer,.009,.0025,[px,py,pz-side*.010],'silver');}}
  if(rear){for(let i=0;i<14;i++)for(const side of [-1,1]){const a=i*Math.PI*2/14;const m=mounted(tire,[0,0,0],-a);softBox(m,[.064,.032,width*.64],[0,r*.99,side*width*.21],'tire',[0,side*.48,0]);}}
  else{for(let j=0;j<3;j++)ring(tire,r*.984,.003,[0,0,(j-1)*width*.19],'black');for(let i=0;i<36;i++){const a=i*Math.PI*2/36;const m=mounted(tire,[0,0,0],-a);box(m,[.009,.008,width*.82],[0,r*.99,0],'tire');}}
 }
 wheel('frontL',.77,.175,-.59,.173,.10,false,[.45,.025,-.52]);
 wheel('frontR',.77,.175,.59,.173,.10,false,[.45,.025,.52]);
 wheel('rearL',-.37,.266,-.60,.248,.14,true,[-.3,.025,-.62]);
 wheel('rearR',-.37,.266,.60,.248,.14,true,[-.3,.025,.62]);
 const trans=part('transmission',[-.20,.39,0],[-.05,.0,.5]);
 const transCase=piece(trans,'case','ミッションケース',[0,.15,-.12]);softBox(transCase,[.28,.24,.43],[0,0,0],'metal');for(let i=0;i<5;i++)box(transCase,[.29,.015,.46],[0,-.08+i*.044,0],'black');
 const axle=piece(trans,'axle','車軸',[0,-.08,-.23]);cyl(axle,.065,1.11,[-.10,-.1,0],'black','z');
 for(const [x,r,key,name] of [[-.04,.09,'pulley-a','プーリ A'],[.30,.07,'pulley-b','プーリ B']]){const pulley=piece(trans,key,name,[x<0?-.18:.18,.08,.14]);cyl(pulley,r,.06,[x,.10,.30],'metal','z');ring(pulley,r,.011,[x,.10,.33],'black');}
 const belt=piece(trans,'belt','駆動ベルト（経路は模式）',[0,.28,.30]);rod(belt,[-.04,.19,.33],[.30,.17,.33],.007,'black');rod(belt,[-.04,.01,.33],[.30,.03,.33],.007,'black');

 const trayrail=part('trayrail',[-.31,.94,0],[-.03,.37,0]);
 const rail=mounted(trayrail);const railShape=[[-.48,-.04],[-.48,.052],[-.26,.07],[.28,.12],[.49,.045],[.49,-.038]];
 for(const z of [-.285,.285]){panel(rail,railShape,.035,[0,0,z],'ivory');for(const x of [-.30,-.08,.20,.42])bolt(rail,[x,.035,z+(z>0?.024:-.024)]);}
 for(const x of [-.46,-.28,.15,.47])box(rail,[.03,.04,.61],[x,-.023,0],'ivory');
 for(const z of [-.285,.285])rod(rail,[-.44,.09,z],[.38,.16,z],.013,'silver');
 const topper=mounted(trayrail,[-.30,.41,0],-.95);for(const z of [-.24,-.12,0,.12,.24])box(topper,[.19,.025,.02],[-.03,0,z],'teal');for(const x of [-.13,.07])box(topper,[.025,.025,.50],[x,0,0],'teal');
 const feed=part('trayfeed',[-.29,.88,0],[-.35,.1,-.51]);const f=mounted(feed);
 for(const z of [-.19,.19]){box(f,[.84,.038,.017],[0,0,z],'black');for(let i=0;i<28;i++)box(f,[.016,.035,.038],[-.40+i*.029,.017,z],'metal');}
 for(let i=0;i<8;i++)rod(f,[-.39+i*.111,.04,-.26],[-.39+i*.111,.04,.26],.008,'silver');
 const tray=part('seedtray',[-.43,1.08,0],[-.30,.66,.14]);const t=mounted(tray);
 box(t,[.56,.035,.29],[0,0,0],'tray');for(const z of [-.153,.153])box(t,[.59,.045,.013],[0,.008,z],'black');for(const x of [-.287,.287])box(t,[.013,.045,.32],[x,.008,0],'black');
 for(let i=0;i<20;i++)for(let j=0;j<10;j++){const x=-.265+i*.0278,z=-.132+j*.0293;cyl(t,.010,.009,[x,.023,z],'soil','y',.008,6);rod(t,[x,.024,z],[x,.07,z],.0018,'leaf');for(const s of [-1,1]){const leaf=mesh(t,new T.SphereGeometry(1,6,4),(i+j)%3?'leaf':'leafLight',[x+s*.011,.064,z+s*.004],[0,.1,s*.62]);leaf.scale.set(.017,.006,.010);}}

 const pickercover=part('pickercover',[-.24,.71,0],[.24,.46,.49]);
 panel(pickercover,[[-.18,-.07],[-.19,.1],[-.08,.18],[.15,.15],[.22,.035],[.16,-.07]],.39,[0,0,0],'ivory',.012);
 for(const s of [-1,1]){bolt(pickercover,[-.09,.045,s*.203]);box(pickercover,[.115,.035,.008],[.1,.04,s*.201],'tealDark');}
 const pickerdrive=part('pickerdrive',[-.38,.67,0],[-.43,.24,-.35]);
 for(const side of [-1,1]){const linkage=piece(pickerdrive,side<0?'left':'right','苗取出しリンク '+(side<0?'A':'B'),[0,.06,side*.16]);const crank=piece(linkage,'crank','駆動アーム（模式）',[-.10,0,0]);cyl(crank,.073,.03,[0,0,side*.16],'metal','z');cyl(crank,.025,.045,[0,0,side*.17],'silver','z');const upper=piece(linkage,'upper','連結ロッド A',[.07,.09,0]);rod(upper,[0,.015,side*.16],[.16,.13,side*.14],.017,'silver');const lower=piece(linkage,'lower','連結ロッド B',[.13,-.04,0]);rod(lower,[.16,.13,side*.14],[.24,-.055,side*.08],.014,'metal');}
 const cross=piece(pickerdrive,'cross','連結軸',[.12,-.10,0]);rod(cross,[.24,-.055,-.08],[.24,-.055,.08],.014,'silver');
 const picker=part('picker',[-.16,.60,0],[.21,.40,.79]);
 const holder=piece(picker,'holder','爪の支持部',[0,.14,0]);box(holder,[.045,.04,.11],[0,.047,0],'metal');
 for(const side of [-1,1]){const claw=piece(picker,side<0?'claw-a':'claw-b',side<0?'苗取出し爪 A':'苗取出し爪 B',[0,-.04,side*.13]);rod(claw,[0,.045,side*.034],[.034,-.035,side*.028],.006,'silver');rod(claw,[.034,-.035,side*.028],[-.016,-.098,side*.014],.004,'silver');}
 const pickerShaft=piece(picker,'shaft','支点軸',[-.13,.04,0]);cyl(pickerShaft,.022,.14,[-.025,.06,0],'metal','z');
 const caseg=part('cupcase',[-.43,.48,.27],[-.23,.08,.77]);const cupCover=piece(caseg,'cover','植付ケースカバー',[0,0,.17]);panel(cupCover,[[-.19,-.09],[-.19,.11],[.15,.14],[.19,-.09]],.035,[0,0,0],'ivory',.006);for(const x of [-.135,.135]){const fixing=piece(caseg,x<0?'fix-a':'fix-b','カバー取付部（例示）',[x<0?-.08:.08,.06,.24]);bolt(fixing,[x,.05,.026]);}
 const cup=part('cup',[-.39,.30,0],[-.14,.025,.70]);
 for(const side of [-1,1]){const key=side<0?'a':'b',label=side<0?'A':'B';const halfPart=piece(cup,'half-'+key,'植付カップ片 '+label,[0,-.025,side*.15]);const half=new T.CylinderGeometry(.068,.015,.19,20,1,true,side<0?0:Math.PI,Math.PI);mesh(halfPart,half,'silver',[0,0,side*.002]);const link=piece(cup,'link-'+key,'支持リンク '+label,[side*.14,.07,side*.12]);rod(link,[0,.135,side*.065],[0,.035,side*.07],.009,'metal');}
 const cupRing=piece(cup,'ring','支持環',[0,.20,0]);ring(cupRing,.067,.006,[0,.1,0],'metal','y');const cupShaft=piece(cup,'shaft','支点軸',[.20,.05,0]);cyl(cupShaft,.020,.17,[0,.125,0],'metal','z');
 const rubF=part('soilrubberF',[-.285,.22,0],[.35,.015,.37]);const rubberF=piece(rubF,'rubber','前側の土落としゴム',[.15,0,0]);box(rubberF,[.025,.075,.16],[0,0,0],'black',[0,0,.28]);const supportF=piece(rubF,'support','支持棒',[0,.14,0]);rod(supportF,[0,.04,-.085],[0,.04,.085],.009,'metal');
 const rubR=part('soilrubberR',[-.51,.22,0],[-.45,.02,.30]);const rubberR=piece(rubR,'rubber','後側の土落としゴム',[-.15,0,0]);box(rubberR,[.022,.070,.16],[0,0,0],'black',[0,0,-.28]);const supportR=piece(rubR,'fasteners','取付部（締結部品の模式表示）',[.12,.10,0]);for(const z of [-.055,.055])bolt(supportR,[-.015,.021,z],'x');
 const roller=part('roller',[-.61,.15,0],[-.62,.02,0]);const drum=piece(roller,'drum','ローラ本体',[0,-.06,0]);cyl(drum,.080,.25,[0,0,0],'black','z');for(const z of [-.16,.16]){const arm=piece(roller,z<0?'arm-a':'arm-b',z<0?'支持部 A':'支持部 B',[.05,.07,z<0?-.17:.17]);rod(arm,[0,0,z],[.18,.29,z],.014,'ivory');cyl(arm,.025,.04,[0,0,z],'silver','z');}
 for(const side of [-1,1]){const r=part(side<0?'pressL':'pressR',[-.75,.16,side*.18],[-.38,.02,side*.55]);const body=piece(r,'roller','覆土ローラ本体',[0,-.04,-.13]);cyl(body,.105,.065,[0,0,0],'black','z');const hub=piece(r,'hub','中心支持部',[0,0,.13]);cyl(hub,.050,.07,[0,0,0],'metal','z');const arm=piece(r,'arm','支持アーム',[.13,.16,0]);rod(arm,[0,0,0],[.25,.28,-side*.02],.016,'ivory');}
 const drive=part('drivecase',[-.15,.36,.43],[.05,.22,.73]);
 const cover=piece(drive,'cover','チェーンケース外側カバー',[0,.04,.19]);capsule(cover,.79,.205,.051,[0,0,.014],'black');
 const back=piece(drive,'back','ケース内側プレート',[0,0,-.14]);capsule(back,.77,.19,.014,[0,0,-.023],'metal');
 for(const x of [-.29,.29]){const fixing=piece(drive,x<0?'mount-a':'mount-b','ケース取付部 '+(x<0?'A':'B'),[x<0?-.08:.08,.08,.29]);const seat=piece(fixing,'seat','取付座（模式）',[0,0,-.08]);cyl(seat,.042,.016,[x,0,.049],'black','z');const screw=piece(fixing,'bolt','取付ボルト（模式）',[0,0,.08]);bolt(screw,[x,0,.065]);}

 const handle=part('handle',[-.77,.72,0],[-.51,.26,0]);
 for(const s of [-1,1]){tube(handle,[[.48,-.28,s*.27],[.20,-.17,s*.34],[-.30,.17,s*.39],[-.37,.19,s*.34]],.016,'ivory');rod(handle,[-.30,.17,s*.38],[-.13,.15,s*.38],.024,'black');rod(handle,[-.29,.135,s*.33],[-.12,.13,s*.33],.008,'black');tube(handle,[[-.18,.14,s*.35],[.12,.08,s*.28],[.30,-.15,s*.20]],.004,'black');}
 rod(handle,[-.30,.17,-.34],[-.30,.17,.34],.017,'ivory');rod(handle,[-.31,.215,-.02],[-.31,.215,.17],.006,'black');
 const console=part('console',[-.83,1.025,0],[-.49,.46,.36]);
 softBox(console,[.20,.025,.55],[0,0,0],'ivory',[0,0,.06]);softBox(console,[.075,.015,.16],[-.025,.024,0],'black');softBox(console,[.06,.018,.125],[-.03,.03,0],'metal');
 for(const [i,[x,z,h]] of [[.02,-.21,.14],[.065,.22,.11],[-.04,-.13,.06]].entries()){const lever=piece(console,'lever-'+i,'操作レバー '+String.fromCharCode(65+i),[0,.12,z]);const shaft=piece(lever,'shaft','レバー軸',[.05,0,0]);rod(shaft,[x,.02,z],[x+.035,h,z],.008,'metal');const knob=piece(lever,'knob','操作ノブ',[0,.08,0]);softBox(knob,[.04,.035,.035],[x+.038,h+.008,z],z>0?'red':'black');}
 for(let j=-1;j<=1;j++)cyl(console,.011,.014,[-.06,.033,.115+j*.03],j===0?'red':'black');
 const spare=part('spares',[.21,1.08,-.12],[.04,.60,-.64]);
 function rack(g,x,y,z,w=.32){const len=.59;for(const zz of [-w/2,w/2])rod(g,[x-len/2,y,z+zz],[x+len/2,y,z+zz],.011,'ivory');for(const xx of [-len/2,len/2])rod(g,[x+xx,y,z-w/2],[x+xx,y,z+w/2],.011,'ivory');for(let i=0;i<4;i++)rod(g,[x-.22+i*.145,y,z-w/2],[x-.22+i*.145,y,z+w/2],.006,'ivory');for(const zz of [-w/2,w/2])rod(g,[x-len/2,y+.026,z+zz],[x+len/2,y+.026,z+zz],.008,'ivory');}
 // W-specific high, wide racks with access from the machine's left.
 for(const z of [-.20,.18]){rod(spare,[.02,-.47,z],[.02,.22,z],.017,'ivory');rack(spare,0,.23,z,.33);rack(spare,0,-.015,z,.33);}
 rack(spare,.10,-.23,-.12,.34);
 const frontstand=part('frontstand',[.85,.40,0],[.62,.08,0]);
 tube(frontstand,[[.08,-.1,-.23],[.20,-.03,-.23],[.20,.0,.23],[.08,-.1,.23]],.018,'black');for(const z of [-.21,.21])rod(frontstand,[.1,-.02,z],[.06,-.26,z],.012,'metal');rod(frontstand,[.06,-.26,-.21],[.06,-.26,.21],.012,'metal');
 const backstand=part('rearstand',[-.75,.41,0],[-.67,.01,-.22]);
 tube(backstand,[[.12,.07,-.19],[-.14,-.09,-.19],[-.14,-.14,.19],[.12,.07,.19]],.012,'ivory');
 for(const z of [-.28,.28])rod(backstand,[.12,.1,z],[-.23,.21,z],.010,'ivory');for(const x of [-.22,-.09,.04])rod(backstand,[x,.18,-.28],[x,.18,.28],.007,'metal');
 return finish(META.dimensions);
}
