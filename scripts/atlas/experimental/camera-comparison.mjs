import { proxyFor } from './reconstruct.mjs';
import { comparePriorProfiles } from './prior-evaluation.mjs';
import { EXPANDED_PRIOR_PROFILE } from './prior-families.mjs';
import { AFFINE_POLICY,fitAffineCamera,projectAffine,affinePredictionGain } from './affine-camera.mjs';

const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const rmse=values=>values.length&&values.every(Number.isFinite)
  ?Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length):null;
const ratio=(a,b)=>a!==null&&b!==null&&b>0?a/b:null;
function metrics(folds){
  const affine=rmse(folds.map(f=>f.affine.errorPx)),grid=rmse(folds.map(f=>f.grid.errorPx)),centroid=rmse(folds.map(f=>f.centroid.errorPx));
  return {count:folds.length,affineRmsePx:affine,gridRmsePx:grid,centroidRmsePx:centroid,
    affineToGrid:ratio(affine,grid),affineToCentroid:ratio(affine,centroid)};
}
function beatsBoth(m){return m.affineToGrid!==null&&m.affineToGrid<1&&m.affineToCentroid!==null&&m.affineToCentroid<1}

export function compareCameraModels(machine){
  // Reuse v3 observations, grouping and grid predictions without changing its implementation.
  const previous=comparePriorProfiles(machine),gridExperiment=previous.expanded;
  const parts=new Map(machine.parts.map(p=>[p.id,p]));
  const groups=gridExperiment.views.map(view=>{
    const base={id:view.id,figureKey:view.figureKey,regionId:view.regionId,regionBounds:view.regionBounds,
      partIds:view.partIds.slice(),count:view.count};
    if(view.count<AFFINE_POLICY.minimumGroupPoints)return {...base,status:'insufficient-anchors',minimum:5,
      folds:[],assessment:'unavailable'};
    const observations=view.partIds.map(id=>{
      const part=parts.get(id),proxy=proxyFor(part.name,machine.dimensionsMm,EXPANDED_PRIOR_PROFILE);
      return {id,name:part.name,marker:part.positionEvidence.marker??null,prior:proxy.geom.position,
        xy:part.positionEvidence.imageXY,added:Boolean(proxy.priorDefinition)};
    });
    const oldFolds=new Map((view.predictiveEvaluation?.folds??[]).map(f=>[f.id,f]));
    const full=fitAffineCamera(observations);
    const folds=observations.map((o,i)=>{
      const training=observations.filter((_,j)=>i!==j),trainingIds=training.map(p=>p.id),old=oldFolds.get(o.id);
      if(old&&JSON.stringify(old.trainingIds)!==JSON.stringify(trainingIds))throw Error('grid-fold-membership-mismatch');
      const fitted=fitAffineCamera(training);
      const prediction=fitted.status==='fitted'?projectAffine(o.prior,fitted.model):null;
      const finite=prediction?.every(Number.isFinite),valid=Boolean(finite);
      const mean=[0,1].map(k=>training.reduce((s,p)=>s+p.xy[k],0)/training.length);
      if(old&&distance(mean,old.centroidPredictionXY)>1e-8)throw Error('centroid-fold-mismatch');
      const {model,...diagnostics}=fitted;
      return {id:o.id,name:o.name,marker:o.marker,added:o.added,prior:o.prior.slice(),sourceXY:o.xy.slice(),trainingIds,
        affine:{...diagnostics,status:valid?'fitted':fitted.status==='fitted'?'non-finite-prediction':fitted.status,
          predictionXY:valid?prediction:null,errorPx:valid?distance(prediction,o.xy):null,
          predictionGain:valid?affinePredictionGain(o.prior,model):null,
          matrix:model?.matrix??null,offset:model?.offset??null},
        grid:{status:old?.heldOutPredictionXY?'fitted':'unavailable',predictionXY:old?.heldOutPredictionXY??null,
          errorPx:old?.heldOutErrorPx??null},
        centroid:{predictionXY:mean,errorPx:distance(mean,o.xy)}};
    });
    const all=metrics(folds),legacy=metrics(folds.filter(f=>!f.added)),added=metrics(folds.filter(f=>f.added));
    const shape=JSON.parse(view.figureKey).slice(-2),bounds=view.regionBounds;
    const imageDiagonal=Math.hypot(...shape),regionDiagonal=Math.hypot(bounds[2]-bounds[0],bounds[3]-bounds[1]);
    const failed=folds.filter(f=>f.affine.status!=='fitted');
    const comparable=full.status==='fitted'&&all.affineToGrid!==null&&all.affineToCentroid!==null&&legacy.affineToGrid!==null&&legacy.affineToCentroid!==null;
    return {...base,status:failed.length?'incomplete-affine-loo':'comparison-completed',fullAffineFit:full,
      all,cohorts:{legacy,added},affineFailures:failed.map(f=>({id:f.id,reason:f.affine.status})),
      maxPredictionGain:folds.every(f=>Number.isFinite(f.affine.predictionGain))?Math.max(...folds.map(f=>f.affine.predictionGain)):null,
      affineFractionOfImageDiagonal:all.affineRmsePx===null?null:all.affineRmsePx/imageDiagonal,
      affineFractionOfRegionDiagonal:all.affineRmsePx===null?null:all.affineRmsePx/regionDiagonal,
      assessment:!comparable?'unavailable':beatsBoth(all)&&beatsBoth(legacy)?'conditional-prediction-gain':'gain-not-supported',
      interpretation:'Paired 2D predictive comparison only; residuals do not isolate shape error',folds};
  });
  return {gridExperiment,report:{version:'atlas-camera-comparison-v4',machineId:machine.machineId,name:machine.name,
    priorProfile:EXPANDED_PRIOR_PROFILE,counts:gridExperiment.counts,policy:AFFINE_POLICY,
    hypotheses:{grid:'unchanged v3 orthographic yaw/elevation grid',affine:'unconstrained 2x3 plus translation, 8 coefficients',
      centroid:'same training endpoints, mean position, no camera'},
    invariant:'same 22 priors, parts, regions and held-out IDs; no 3D positions updated',
    acceptance:{stageA3dPassed:false,documented3dParts:0,shapeQualityDirectlyMeasured:false},groups}};
}
