// Predictive diagnostics only: lower 2D error never verifies real 3D geometry.
import { proxyFor,fitCamera,project,reconstructHypotheses } from './reconstruct.mjs';
import { BASE_PRIOR_PROFILE,EXPANDED_PRIOR_PROFILE,EXTRA_PRIOR_FAMILIES } from './prior-families.mjs';

const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const rmse=values=>values.length&&values.every(Number.isFinite)
  ?Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length):null;
const comparison=(camera,centroid)=>camera===null||centroid===null||centroid===0
  ?'unavailable':camera<centroid?'lower':'not-lower';
const groupKey=v=>JSON.stringify([v.figureKey,v.regionId,v.regionBounds]);

export function evaluatePriorView(machine,view,priorProfile) {
  if(view.status!=='candidate'||!view.camera)return {status:'not-calculated',reason:view.status};
  const byId=new Map(machine.parts.map(p=>[p.id,p]));
  const observations=view.partIds.map(id=>{
    const p=byId.get(id),prior=proxyFor(p.name,machine.dimensionsMm,priorProfile);
    return {id,name:p.name,family:prior.family,prior:prior.geom.position,
      xy:p.positionEvidence.imageXY,addedFamily:EXTRA_PRIOR_FAMILIES.some(f=>f.id===prior.family)};
  });
  const folds=observations.map((o,i)=>{
    // Both predictors use exactly the same training endpoints, excluding the target point.
    const training=observations.filter((_,j)=>j!==i),camera=fitCamera(training);
    const prediction=camera?project(o.prior,camera):null;
    const mean=[0,1].map(k=>training.reduce((s,p)=>s+p.xy[k],0)/training.length);
    return {id:o.id,name:o.name,family:o.family,addedFamily:o.addedFamily,
      trainingIds:training.map(p=>p.id),sourceXY:o.xy.slice(),
      heldOutPredictionXY:prediction,heldOutErrorPx:prediction?distance(prediction,o.xy):null,
      centroidPredictionXY:mean,centroidErrorPx:distance(mean,o.xy)};
  });
  const camera=rmse(folds.map(f=>f.heldOutErrorPx)),centroid=rmse(folds.map(f=>f.centroidErrorPx));
  const [x0,y0,x1,y1]=view.regionBounds,regionDiagonal=Math.hypot(x1-x0,y1-y0);
  const size=JSON.parse(view.figureKey).slice(-2),imageDiagonal=Math.hypot(...size);
  const cohorts=Object.fromEntries([['legacy',false],['added',true]].map(([name,isAdded])=>{
    const rows=folds.filter(f=>f.addedFamily===isAdded);
    return [name,{count:rows.length,cameraRmsePx:rmse(rows.map(f=>f.heldOutErrorPx)),
      centroidRmsePx:rmse(rows.map(f=>f.centroidErrorPx))}];
  }));
  return {status:'measured',meaning:'conditional 2D prediction under category priors; not 3D accuracy',
    count:folds.length,uniqueFamilies:new Set(observations.map(o=>o.family)).size,
    uniquePriorCenters:new Set(observations.map(o=>JSON.stringify(o.prior))).size,
    cameraRmsePx:camera,centroidRmsePx:centroid,
    cameraToCentroidRatio:camera!==null&&centroid>0?camera/centroid:null,
    relativeToCentroid:comparison(camera,centroid),
    cameraFractionOfImageDiagonal:camera===null?null:camera/imageDiagonal,
    cameraFractionOfRegionDiagonal:camera===null?null:camera/regionDiagonal,
    folds,cohorts,documented3dParts:0,reviewRequired:true};
}

export function comparePriorProfiles(machine) {
  const baseline=reconstructHypotheses(machine);
  const expanded=reconstructHypotheses(machine,{priorProfile:EXPANDED_PRIOR_PROFILE});
  for(const v of expanded.views)v.predictiveEvaluation=evaluatePriorView(machine,v,EXPANDED_PRIOR_PROFILE);
  const baselineGroups=new Map(baseline.views.map(v=>[groupKey(v),v]));
  const expandedGroups=new Map(expanded.views.map(v=>[groupKey(v),v]));
  const groups=[...new Set([...baselineGroups.keys(),...expandedGroups.keys()])].sort().map(key=>{
    const old=baselineGroups.get(key),now=expandedGroups.get(key),v=now??old;
    const oldErrors=new Map((old?.correspondences??[]).map(p=>[p.id,p.heldOutErrorPx]));
    const common=(now?.predictiveEvaluation?.folds??[]).filter(f=>oldErrors.has(f.id));
    return {figureKey:v.figureKey,regionId:v.regionId,regionBounds:v.regionBounds,
      baseline:{profile:BASE_PRIOR_PROFILE,count:old?.count??0,status:old?.status??'no-anchors',
        cameraRmsePx:old?.leaveOneOutRmsePx??null},
      expanded:{profile:EXPANDED_PRIOR_PROFILE,count:now?.count??0,status:now?.status??'no-anchors',
        predictiveEvaluation:now?.predictiveEvaluation??{status:'not-calculated',reason:'no-anchors'}},
      addedPartIds:(now?.partIds??[]).filter(id=>!old?.partIds.includes(id)),
      commonTargets:{count:common.length,baselineCameraRmsePx:rmse(common.map(f=>oldErrors.get(f.id))),
        expandedCameraRmsePx:rmse(common.map(f=>f.heldOutErrorPx)),
        note:old?.status==='candidate'?'same held-out IDs; expanded training contains additional parts':
          'baseline has no admissible camera; no baseline-camera improvement can be claimed'}};
  });
  const report={version:'atlas-prior-comparison-v3',baseProfile:BASE_PRIOR_PROFILE,
    expandedProfile:EXPANDED_PRIOR_PROFILE,baseFamilies:14,addedFamilies:EXTRA_PRIOR_FAMILIES.length,
    totalFamilies:14+EXTRA_PRIOR_FAMILIES.length,definitions:EXTRA_PRIOR_FAMILIES,
    inputPolicy:'same annotated original for both profiles; no labels, coordinates or thresholds edited',
    acceptance:{stageA3dPassed:false,documented3dParts:0,
      reason:'An admissible camera and a lower 2D LOO error do not establish real 3D correspondence'},
    groups,counts:{baseline:baseline.counts,expanded:expanded.counts}};
  return {baseline,expanded,report};
}
