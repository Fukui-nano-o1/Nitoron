import test from 'node:test';
import assert from 'node:assert/strict';
import { fitAffineCamera,projectAffine,affinePredictionGain } from '../scripts/atlas/experimental/affine-camera.mjs';
import { compareCameraModels } from '../scripts/atlas/experimental/camera-comparison.mjs';
import { comparePriorProfiles } from '../scripts/atlas/experimental/prior-evaluation.mjs';
import { proxyFor } from '../scripts/atlas/experimental/reconstruct.mjs';
import { EXPANDED_PRIOR_PROFILE } from '../scripts/atlas/experimental/prior-families.mjs';
import { expandedSyntheticMachine,expandedRasterFixture } from './helpers/atlas-prior-fixture.mjs';
import { attachRasterRegions } from '../scripts/atlas/experimental/figure-regions.mjs';

const matrix=[[300,120,50],[-80,400,40]],offset=[200,250];
const mapped=p=>matrix.map((r,i)=>r.reduce((s,v,k)=>s+v*p[k],offset[i]));
const points=[[0,0,0],[1,0,0],[0,1,0],[0,0,1],[1,1,1]];
const observations=()=>points.map(prior=>({prior:prior.slice(),xy:mapped(prior)}));
const close=(a,b,tolerance=1e-8)=>assert.ok(Math.hypot(...a.flat().map((v,i)=>v-b.flat()[i]))<tolerance);
function cameraFixture(){
  const m=expandedSyntheticMachine();
  for(const p of m.parts){const x=proxyFor(p.name,m.dimensionsMm,EXPANDED_PRIOR_PROFILE).geom.position;
    p.positionEvidence.imageXY=[450+280*x[0]+110*x[1]+160*x[2],600-55*x[0]-390*x[1]+90*x[2]]}
  return m;
}

test('full affine QR recovers a known eight-coefficient map with roll, shear and unequal scales',()=>{
  const f=fitAffineCamera(observations());assert.equal(f.status,'fitted');assert.equal(f.diagnostics.rank,4);
  close(f.model.matrix,matrix);close(f.model.offset,offset);assert.ok(f.trainingRmsePx<1e-9);
  close(projectAffine([.2,.3,.4],f.model),mapped([.2,.3,.4]));
  assert.ok(Math.abs(f.model.rowCosine)>.01);assert.ok(Math.abs(f.model.rowNormRatio-1)>.01);
  assert.equal(f.model.physicalCameraVerified,false);
});
test('four full-rank training points are exactly determined but do not verify real geometry',()=>{
  const f=fitAffineCamera(observations().slice(0,4));assert.equal(f.status,'fitted');
  assert.equal(f.justDeterminedIfFullRank,true);assert.equal(f.nominalResidualDegreesPerOutput,0);
  assert.equal(f.model.physicalCameraVerified,false);
});
test('coplanar or identical prior points return rank failure without a guessed camera',()=>{
  const f=fitAffineCamera(observations().map(o=>({...o,prior:[o.prior[0],o.prior[1],0]})));
  assert.equal(f.status,'rank-deficient');assert.ok(f.diagnostics.rank<4);assert.equal(f.model,undefined);
  const g=fitAffineCamera(observations().map(o=>({...o,prior:[1,1,1]})));
  assert.equal(g.status,'rank-deficient');assert.equal(g.model,undefined);
});
test('near-coplanarity is retained by isotropic normalization and refused when ill-conditioned',()=>{
  const f=fitAffineCamera(observations().map(o=>({...o,prior:[o.prior[0],o.prior[1],o.prior[2]*1e-9]})));
  assert.equal(f.status,'ill-conditioned');assert.equal(f.diagnostics.rank,4);
  assert.ok(f.diagnostics.conditionInfR>1e8);assert.equal(f.model,undefined);
});
test('QR fit preserves predictions after changing world units and adding a large translation',()=>{
  const data=observations().map(o=>({...o,prior:o.prior.map((x,k)=>x*1000+[1e7,-2e7,3e7][k])}));
  const f=fitAffineCamera(data);assert.equal(f.status,'fitted');
  for(const o of data)close(projectAffine(o.prior,f.model),o.xy,1e-7);
});
test('held-out leverage matches measured response to independent one-pixel training perturbations',()=>{
  const data=observations(),target=[.2,.3,.4],f=fitAffineCamera(data),origin=projectAffine(target,f.model);
  const changes=data.map((_,i)=>{
    const input=structuredClone(data);input[i].xy[0]+=1;
    return projectAffine(target,fitAffineCamera(input).model)[0]-origin[0];
  });
  assert.ok(Math.abs(Math.hypot(...changes)-affinePredictionGain(target,f.model))<1e-8);
});
test('paired LOO uses the same IDs and excludes the target in normalization and both fits',()=>{
  const m=cameraFixture(),a=compareCameraModels(m),g=a.report.groups[0],f=g.folds[0];
  assert.equal(g.assessment,'conditional-prediction-gain');assert.ok(g.all.affineRmsePx<1e-7);
  assert.ok(g.all.gridRmsePx>1);assert.ok(!f.trainingIds.includes(f.id));
  const changed=structuredClone(m),part=changed.parts.find(p=>p.id===f.id);part.positionEvidence.imageXY[0]+=140;
  const b=compareCameraModels(changed).report.groups[0].folds.find(x=>x.id===f.id);
  assert.deepEqual(b.affine.matrix,f.affine.matrix);assert.deepEqual(b.affine.offset,f.affine.offset);
  assert.deepEqual(b.affine.predictionXY,f.affine.predictionXY);
  assert.deepEqual(b.grid.predictionXY,f.grid.predictionXY);
  assert.deepEqual(b.centroid.predictionXY,f.centroid.predictionXY);
  assert.ok(b.affine.errorPx>139);
});
test('affine shape deformation can leave all held-out predictions unchanged: not a shape-quality test',()=>{
  const data=observations(),warped=data.map(o=>({...o,prior:[2*o.prior[0]+.3*o.prior[1],o.prior[1],1.5*o.prior[2]]}));
  assert.notDeepEqual(data.map(o=>o.prior),warped.map(o=>o.prior));
  for(let i=0;i<data.length;i++){
    const a=fitAffineCamera(data.filter((_,j)=>j!==i)),b=fitAffineCamera(warped.filter((_,j)=>j!==i));
    close(projectAffine(data[i].prior,a.model),projectAffine(warped[i].prior,b.model));
  }
});
test('incomplete LOO is reported in full rather than dropping rank-deficient folds',()=>{
  const m=cameraFixture();m.parts=m.parts.slice(0,5);
  // Distinct part IDs are not necessarily geometrically independent anchors.
  m.parts.forEach((p,i)=>p.name=i<4?'燃料タンク':'エアクリーナ');
  const r=compareCameraModels(m),g=r.report.groups[0];
  assert.equal(g.folds.length,5);assert.equal(g.affineFailures.length,5);
  assert.ok(g.folds.every(f=>f.affine.status==='rank-deficient'&&f.affine.predictionXY===null));
  assert.equal(g.all.affineRmsePx,null);assert.equal(g.assessment,'unavailable');
  assert.equal(r.report.acceptance.shapeQualityDirectlyMeasured,false);
});
test('same original regions remain separate and sub-five groups remain stopped',async()=>{
  const f=expandedRasterFixture(),annotated=await attachRasterRegions(f.machine,async()=>f.png);
  const r=compareCameraModels(annotated.machine);assert.deepEqual(r.report.groups.map(g=>g.count),[9,6]);
  assert.notEqual(r.report.groups[0].regionId,r.report.groups[1].regionId);
  for(const g of r.report.groups)for(const fold of g.folds)assert.ok(fold.trainingIds.every(id=>g.partIds.includes(id)));
  const m=cameraFixture();m.parts=m.parts.slice(0,4);
  const stopped=compareCameraModels(m).report.groups[0];assert.equal(stopped.status,'insufficient-anchors');
  assert.equal(stopped.fullAffineFit,undefined);assert.deepEqual(stopped.folds,[]);
});
test('comparison leaves v3 geometry and input unchanged and is reproducible under input reordering',()=>{
  const m=cameraFixture(),before=structuredClone(m),expected=comparePriorProfiles(m).expanded,a=compareCameraModels(m);
  assert.deepEqual(m,before);assert.deepEqual(a.gridExperiment,expected);
  assert.equal(a.report.acceptance.documented3dParts,0);assert.equal(a.report.acceptance.stageA3dPassed,false);
  for(const g of a.report.groups){assert.equal(g.updates,undefined);assert.equal(g.variants,undefined)}
  const b=compareCameraModels(m);m.parts.reverse();assert.deepEqual(a,b);assert.deepEqual(a,compareCameraModels(m));
});
test('invalid numerical inputs fail explicitly and fewer than four training points are not fitted',()=>{
  assert.throws(()=>fitAffineCamera([{prior:[NaN,0,0],xy:[0,0]}]),/invalid-affine/);
  assert.equal(fitAffineCamera(observations().slice(0,3)).status,'insufficient-training-points');
});
