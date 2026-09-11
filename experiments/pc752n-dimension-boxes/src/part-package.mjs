// Strict local geometry interchange. No scripts, network URLs to load, CAD parser,
// fitting, parent/transform edits, or inferred dimensional certification.
export const PACKAGE_LIMITS=Object.freeze({bytes:8*1024*1024,vertices:100000,indices:600000,coordinate:100000});
export const MACHINE=Object.freeze({maker:'Kubota',model:'PC752N',variant:'single-crawler-standard-rotary',frame:'part-local-mm-v1',units:'mm'});
const fail=(code,message)=>{const e=new Error(message);e.code=code;throw e;};
const record=x=>Boolean(x&&typeof x==='object'&&!Array.isArray(x));
function keys(x,allowed,where){if(!record(x))fail('invalid-package',where+'の形式が不正です');if(Object.keys(x).some(k=>!allowed.includes(k)))fail('unsupported-field',where+'に未対応の項目があります');}
function text(x,max){return typeof x==='string'&&x.length>0&&x.length<=max&&!/[\u0000-\u001f]/.test(x);}
export function parsePackage(raw){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>PACKAGE_LIMITS.bytes)fail('package-too-large','部品ファイルは8 MiB以内にしてください');try{return JSON.parse(raw);}catch{fail('invalid-json','JSON形式の部品ファイルを選んでください');}}
export function validatePackage(p,part){
 keys(p,['schemaVersion','machine','partId','fromRevision','revision','units','frame','geometry','evidence'],'部品データ');
 if(p.schemaVersion!==1)fail('unsupported-version','未対応の部品データ版です');
 keys(p.machine,['maker','model','variant'],'機種');
 if(['maker','model','variant'].some(k=>p.machine[k]!==MACHINE[k]))fail('wrong-machine','機種・仕様が一致しません');
 if(p.units!=='mm'||p.frame!==MACHINE.frame)fail('wrong-frame','mm単位・既定の部品座標系が必要です');
 if(!part||p.partId!==part.id)fail('unknown-part','対象部品IDを確認できません');
 if(p.fromRevision!==part.revision)fail('stale-revision','現在の部品版と一致しません。再度書き出してください');
 if(!text(p.revision,80)||p.revision===p.fromRevision)fail('invalid-revision','異なる新しい部品版を指定してください');
 keys(p.geometry,['positions','indices'],'形状');
 const {positions:v,indices:ix}=p.geometry;
 if(!Array.isArray(v)||v.length<9||v.length%3||v.length/3>PACKAGE_LIMITS.vertices||v.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>PACKAGE_LIMITS.coordinate))fail('invalid-vertices','頂点の数値・上限が不正です');
 const count=v.length/3;
 if(!Array.isArray(ix)||ix.length<3||ix.length%3||ix.length>PACKAGE_LIMITS.indices||ix.some(n=>!Number.isSafeInteger(n)||n<0||n>=count))fail('invalid-indices','面の頂点番号が不正です');
 let surface=false;
 for(let i=0;i<ix.length;i+=3){const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3;const u=[v[b]-v[a],v[b+1]-v[a+1],v[b+2]-v[a+2]],w=[v[c]-v[a],v[c+1]-v[a+1],v[c+2]-v[a+2]];if(Math.hypot(u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0])>1e-6){surface=true;break;}}
 if(!surface)fail('empty-surface','面積を持つ形状がありません');
 keys(p.evidence,['basis','sourceRefs','note'],'根拠');
 if(!['photo-estimate','supplier-cad','measured','verification-fixture'].includes(p.evidence.basis)||!Array.isArray(p.evidence.sourceRefs)||p.evidence.sourceRefs.length>12||p.evidence.sourceRefs.some(x=>!text(x,800))||!text(p.evidence.note,1200))fail('invalid-evidence','出所と確認メモを記載してください');
 // Claims supplied by a file are only declarations. They never grant validation.
 return structuredClone(p);
}
