// SYNTHETIC ONLY. Does not stand in for PC752N or any real manufacturer/model.
import {proxyFor,project} from '../../scripts/atlas/experimental/reconstruct.mjs';
export function syntheticMachine({offsetM=.025}={}){
  const dimensionsMm=[1600,700,1100];
  const camera={yawDeg:60,elevationDeg:25,scale:430,offset:[500,650]};
  const names=['燃料タンク','エアクリーナ','マフラ','リコイルスタータ','エンジン','抵抗棒','ハンドル','主クラッチレバー','主変速レバー','ベルトカバー'];
  const parts=names.map((name,i)=>{
    const p=proxyFor(name,dimensionsMm).geom.position;
    const truth=p.map((v,k)=>v+(k===0?Math.sin(i+1)*offsetM:k===1?Math.cos(i+1)*offsetM:0));
    return {id:'synthetic-'+i,name,slot:null,evidence:{url:'fixture://synthetic'},
      positionEvidence:{url:'fixture://synthetic',page:1,figureSha256:'a'.repeat(64),
        imageSize:[1000,800],imageXY:project(truth,camera),basis:'leader-endpoint',ocrConf:99}};
  });
  return {machineId:'fixture-only-tiller',name:'架空データ / 合成テスト専用',category:'walk-behind-tiller',dimensionsMm,parts,nodes:[]};
}
