// Experimental inverse-graphics proposal. No network, learned model or model-specific coordinates.
// Image endpoints constrain a projection, NOT depth or real geometry. Never promote to documented-3d.
export const VERSION = 'atlas-hypothesis-1';
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const finiteVector = (a, n) => Array.isArray(a) && a.length === n && a.every(Number.isFinite);

// Category-wide engineering assumptions, in machine length/height/width fractions.
// These are shape proxies, NOT extracted CAD, inferred hidden internals, or repair instructions.
const PRIORS = [
  ['fuel-tank', /^燃料タンク(?:$|[（(])/, 'box', [.18,.13,.45], [.03,.72,0]],
  ['air-cleaner', /^エアクリーナ(?:ー)?(?:$|[（(])/, 'box', [.10,.18,.18], [.13,.60,.31]],
  ['muffler', /^マフラ(?:ー)?(?:$|[（(])/, 'box', [.12,.16,.18], [.13,.61,-.31]],
  ['recoil', /^リコイルスタータ(?:ー)?(?:$|[（(])/, 'box', [.08,.18,.22], [-.04,.53,.34]],
  ['engine', /^エンジン(?:$|[（(])/, 'box', [.28,.30,.56], [.06,.48,0]],
  ['resistance-bar', /^抵抗棒(?:$|[（(])/, 'box', [.035,.34,.05], [-.40,.23,0]],
  ['handle', /^ハンドル(?:$|[（(])/, 'box', [.48,.055,.52], [-.24,.84,0]],
  ['clutch-lever', /^主クラッチレバー(?:$|[（(])/, 'box', [.15,.04,.08], [-.36,.91,.24]],
  ['throttle-lever', /^(?:アクセル|スロットル)レバー(?:$|[（(])/, 'box', [.065,.06,.06], [-.31,.85,-.24]],
  ['shift-lever', /^主変速レバー(?:$|[（(])/, 'box', [.035,.25,.05], [-.19,.65,.10]],
  ['belt-cover', /^ベルトカバー(?:$|[（(])/, 'box', [.27,.25,.06], [.03,.38,-.39]],
  ['rotor', /^(?:ロータリ|耕うん爪)(?:$|[（(])/, 'cylinder', [.17,.82], [.10,.19,0]],
  ['wheel', /^(?:移動輪|車輪|タイヤ)(?:$|[（(])/, 'cylinder', [.11,.13], [-.26,.12,0]],
  ['fender', /^(?:フェンダー|ロータリカバー)(?:$|[（(])/, 'box', [.36,.055,.90], [.10,.37,0]],
];

export function cameraBasis(yawDeg, elevationDeg) {
  const a = yawDeg * Math.PI / 180, e = elevationDeg * Math.PI / 180;
  return { right: [Math.cos(a), 0, -Math.sin(a)],
    up: [-Math.sin(a)*Math.sin(e), Math.cos(e), -Math.cos(a)*Math.sin(e)],
    depth: [Math.sin(a)*Math.cos(e), Math.sin(e), Math.cos(a)*Math.cos(e)] };
}
export function project(point, camera) {
  const b = cameraBasis(camera.yawDeg, camera.elevationDeg);
  return [camera.scale * dot(b.right, point) + camera.offset[0],
    -camera.scale * dot(b.up, point) + camera.offset[1]];
}
export function proxyFor(name, dimensionsMm) {
  const p = PRIORS.find(row => row[1].test(String(name).normalize('NFKC').trim()));
  if (!p) return null;
  const [L,W,H] = dimensionsMm.map(v => v/1000), dims = [L,H,W];
  const size = p[2] === 'cylinder' ? [p[3][0]*H, p[3][1]*W] : p[3].map((v,i)=>v*dims[i]);
  const extent = p[2] === 'cylinder' ? [size[0],size[0],size[1]/2] : size.map(v=>v/2);
  const bounds = [[-L/2+extent[0],L/2-extent[0]],[extent[1],H-extent[1]],[-W/2+extent[2],W/2-extent[2]]];
  if (bounds.some(([a,b])=>a>b)) return null;
  const position = p[4].map((v,i)=>clamp(v*dims[i],...bounds[i]));
  return { family:p[0], shapeBasis:'category-proxy', bounds,
    geom:{type:p[2],size,position,...(p[2]==='cylinder'?{axis:'z'}:{})} };
}

// Least-squares orthographic camera for fixed prior points. The camera is a hypothesis.
export function fitCamera(observations, fixedAngles = null) {
  if (observations.length < 3) return null;
  const angles = fixedAngles ? [fixedAngles] : Array.from({length:24},(_,i)=>i*15)
    .flatMap(yawDeg=>[10,25,40,55].map(elevationDeg=>({yawDeg,elevationDeg})));
  const results=[];
  for (const angle of angles) {
    const raw = observations.map(o=>project(o.prior,{...angle,scale:1,offset:[0,0]}));
    const mean = a=>[0,1].map(k=>a.reduce((s,v)=>s+v[k],0)/a.length);
    const mp=mean(raw), mt=mean(observations.map(o=>o.xy));
    let numerator=0, denominator=0;
    for(let i=0;i<raw.length;i++) for(let k=0;k<2;k++) {
      numerator+=(raw[i][k]-mp[k])*(observations[i].xy[k]-mt[k]);
      denominator+=(raw[i][k]-mp[k])**2;
    }
    if(denominator<1e-10) continue;
    const scale=numerator/denominator;
    if(!Number.isFinite(scale)||scale<=1e-8) continue;
    const camera={...angle,scale,offset:mt.map((v,k)=>v-scale*mp[k])};
    const rmse=Math.sqrt(observations.reduce((s,o)=>s+project(o.prior,camera)
      .reduce((t,v,k)=>t+(v-o.xy[k])**2,0),0)/observations.length);
    results.push({...camera,rmse});
  }
  results.sort((a,b)=>a.rmse-b.rmse||a.yawDeg-b.yawDeg||a.elevationDeg-b.elevationDeg);
  return results[0]??null;
}

export function depthSegment(point, direction, bounds) {
  let lo=-Infinity, hi=Infinity;
  for(let k=0;k<3;k++) {
    const [a,b]=bounds[k];
    if(Math.abs(direction[k])<1e-10) { if(point[k]<a-1e-8||point[k]>b+1e-8)return null; continue; }
    const u=(a-point[k])/direction[k],v=(b-point[k])/direction[k];
    lo=Math.max(lo,Math.min(u,v)); hi=Math.min(hi,Math.max(u,v));
  }
  return lo<=hi ? [lo,hi] : null;
}
export function moveTowardObservation(observation,camera,priorWeight=.5) {
  const b=cameraBasis(camera.yawDeg,camera.elevationDeg);
  const uv=project(observation.prior,camera), alpha=1/(1+priorWeight);
  const du=(observation.xy[0]-uv[0])/camera.scale*alpha;
  const dv=(observation.xy[1]-uv[1])/camera.scale*alpha;
  const center=observation.prior.map((v,k)=>clamp(v+du*b.right[k]-dv*b.up[k],...observation.bounds[k]));
  const segment=depthSegment(center,b.depth,observation.bounds);
  return {center,depthNear:segment?center.map((v,k)=>v+segment[0]*b.depth[k]):center.slice(),
    depthFar:segment?center.map((v,k)=>v+segment[1]*b.depth[k]):center.slice(),
    depthSpanM:segment?segment[1]-segment[0]:0};
}

// Hypothesized view separation only. White space/marker gaps do NOT prove separate camera views.
// Emit the unsplit control too; Claude must check segmentation against the original figure.
export function splitByGaps(observations, depth=0) {
  if(observations.length<8||depth>=2)return [observations];
  let best=null;
  for(const axis of [0,1]) {
    const sorted=observations.slice().sort((a,b)=>a.xy[axis]-b.xy[axis]||a.id.localeCompare(b.id));
    const span=sorted.at(-1).xy[axis]-sorted[0].xy[axis];
    if(span<1)continue;
    for(let i=3;i<sorted.length-4;i++) {
      const fraction=(sorted[i+1].xy[axis]-sorted[i].xy[axis])/span;
      if(fraction>.28&&(!best||fraction>best.fraction))best={fraction,sorted,i};
    }
  }
  return best?[...splitByGaps(best.sorted.slice(0,best.i+1),depth+1),
    ...splitByGaps(best.sorted.slice(best.i+1),depth+1)]:[observations];
}

const distance = (a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
function fitGroup(group,index) {
  const base={id:`view-hypothesis-${index+1}`,figureKey:group[0].figureKey,partIds:group.map(o=>o.id),
    segmentationVerified:false,projectionModel:'orthographic-hypothesis',count:group.length};
  if(group.length<5)return {...base,status:'insufficient-anchors',minimum:5};
  const camera=fitCamera(group);
  if(!camera)return {...base,status:'degenerate-camera'};
  const updates=group.map(o=>({id:o.id,...moveTowardObservation(o,camera)}));
  const diagonal=Math.hypot(...group[0].imageSize);
  // Out-of-sample camera prediction: held-out endpoint never participates in the fit.
  const heldOutErrors=group.map((o,i)=>{
    const heldCamera=fitCamera(group.filter((_,j)=>i!==j));
    return heldCamera?distance(project(o.prior,heldCamera),o.xy):null;
  });
  const loo=heldOutErrors.every(Number.isFinite)
    ?Math.sqrt(heldOutErrors.reduce((s,v)=>s+v*v,0)/group.length):null;
  const after=Math.sqrt(group.reduce((s,o,i)=>s+distance(project(updates[i].center,camera),o.xy)**2,0)/group.length);
  return {...base,status:'candidate',camera,updates,
    trainingRmseBeforePx:camera.rmse,trainingRmseAfterPx:after,
    leaveOneOutRmsePx:loo,leaveOneOutFractionOfImageDiagonal:loo===null?null:loo/diagonal,
    reviewRequired:true,depthRangeMeaning:'feasible under assumed camera and bounding box; not confidence interval',
    correspondences:group.map((o,i)=>({id:o.id,sourceXY:o.xy,priorXY:project(o.prior,camera),
      fittedXY:project(updates[i].center,camera),heldOutErrorPx:heldOutErrors[i]}))};
}

export function reconstructHypotheses(machine) {
  if(!finiteVector(machine?.dimensionsMm,3)||machine.dimensionsMm.some(v=>v<100||v>20000))
    throw new Error('invalid-machine-dimensions');
  if(machine.category!=='walk-behind-tiller')throw new Error('unsupported-category');
  if(!Array.isArray(machine.parts))throw new Error('invalid-parts');
  const ids=new Set(), observations=[], proxies=[], excluded=[];
  for(const part of machine.parts.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)))) {
    if(typeof part.id!=='string'||!part.id||ids.has(part.id))throw new Error('invalid-or-duplicate-part-id');
    ids.add(part.id);
    const proxy=proxyFor(part.name,machine.dimensionsMm),e=part.positionEvidence;
    if(!proxy){excluded.push({id:part.id,name:part.name,reason:'no-category-shape-prior'});continue;}
    // Do not convert a legend marker or uncertain adjacent point into a part position.
    const valid=e&&e.basis==='leader-endpoint'&&finiteVector(e.imageXY,2)&&finiteVector(e.imageSize,2)
      &&e.imageSize.every(v=>v>0)&&e.imageXY.every((v,i)=>v>=0&&v<=e.imageSize[i])
      &&typeof e.url==='string'&&e.url.length>0&&typeof e.figureSha256==='string'&&e.figureSha256.length>0
      &&Number.isInteger(e.page)&&e.page>0;
    if(!valid){excluded.push({id:part.id,name:part.name,reason:'no-usable-leader-endpoint'});continue;}
    const figureKey=JSON.stringify([e.url,e.page,e.figureSha256,...e.imageSize]);
    const p={id:part.id,name:part.name,...proxy,evidence:e};
    proxies.push(p);
    observations.push({id:part.id,xy:e.imageXY.slice(),prior:proxy.geom.position.slice(),
      bounds:proxy.bounds,figureKey,imageSize:e.imageSize.slice()});
  }
  const figureGroups=new Map();
  for(const o of observations){if(!figureGroups.has(o.figureKey))figureGroups.set(o.figureKey,[]);figureGroups.get(o.figureKey).push(o);}
  const views=[...figureGroups.values()].flatMap(g=>splitByGaps(g)).map(fitGroup);
  const unsplitControl=[...figureGroups.values()].map(fitGroup);
  const changes=new Map(views.flatMap(v=>(v.updates??[]).map(p=>[p.id,p])));
  const variant = field=>proxies.map(p=>({id:p.id,name:p.name,kind:'part',parent:'machine',
    shapeBasis:'category-proxy',positionBasis:field==='prior'?'category-prior':'projection-constrained-hypothesis',
    geom:{...p.geom,position:field==='prior'?p.geom.position:changes.get(p.id)?.[field]??p.geom.position},
    fitted:field!=='prior'&&changes.has(p.id),evidence:p.evidence}));
  return {version:VERSION,status:changes.size?'candidates-generated':'insufficient-anchors',machineId:machine.machineId,
    name:machine.name,dimensionsMm:machine.dimensionsMm.slice(),
    acceptance:{stageA3dPassed:false,documented3dParts:0,reason:'Only hypotheses; no independent 3D ground truth'},
    assumptions:['category shape and attachment-region priors','orthographic camera per hypothesized view',
      'image leader endpoint treated as proxy center','depth retained from prior; near/far show alternatives'],
    counts:{sourceParts:machine.parts.length,proxyParts:proxies.length,constrainedProxies:changes.size,excluded:excluded.length},
    views,unsplitControl,excluded,
    variants:{prior:variant('prior'),fitted:variant('center'),depthNear:variant('depthNear'),depthFar:variant('depthFar')},
    nextEvidenceNeeded:['confirm view separation and endpoints on original figure',
      'confirm camera/shape/center assumptions; inspect proxy interpenetration',
      'independent multiview or CAD evidence before claiming real 3D positions']};
}
