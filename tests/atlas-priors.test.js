import test from 'node:test';
import assert from 'node:assert/strict';
import { proxyFor,project,fitCamera,reconstructHypotheses } from '../scripts/atlas/experimental/reconstruct.mjs';
import { EXTRA_PRIOR_FAMILIES,EXPANDED_PRIOR_PROFILE,extraPriorFor } from '../scripts/atlas/experimental/prior-families.mjs';
import { comparePriorProfiles } from '../scripts/atlas/experimental/prior-evaluation.mjs';
import { attachRasterRegions } from '../scripts/atlas/experimental/figure-regions.mjs';
import { expandedSyntheticMachine,expandedRasterFixture } from './helpers/atlas-prior-fixture.mjs';
const dims=[1600,700,1100];

test('default reconstruction cannot silently activate the new families',()=>{
  const m=expandedSyntheticMachine();m.parts=m.parts.slice(-8);
  const old=reconstructHypotheses(m),next=reconstructHypotheses(m,{priorProfile:EXPANDED_PRIOR_PROFILE});
  assert.equal(old.version,'atlas-hypothesis-2-regions');
  assert.equal(old.counts.proxyParts,0);assert.equal(old.counts.constrainedProxies,0);
  assert.equal(next.counts.proxyParts,8);assert.equal(next.status,'candidates-generated');
});
test('new subparts are opt-in and do not resolve to parent tank or handle shapes',()=>{
  assert.equal(EXTRA_PRIOR_FAMILIES.length,8);
  assert.equal(new Set(EXTRA_PRIOR_FAMILIES.map(d=>d.id)).size,8);
  for(const d of EXTRA_PRIOR_FAMILIES)for(const name of d.names){
    assert.equal(proxyFor(name,dims),null);
    const p=proxyFor(name,dims,EXPANDED_PRIOR_PROFILE);assert.equal(p.family,d.id);
    assert.equal(p.priorDefinition.provenance,'human-authored-category-assumption');
    assert.equal(p.priorDefinition.documented3d,false);
    assert.equal(extraPriorFor(name+'（注記）').id,d.id);
  }
  assert.equal(proxyFor('燃料タンク',dims,EXPANDED_PRIOR_PROFILE).family,'fuel-tank');
  assert.equal(proxyFor('ハンドル',dims,EXPANDED_PRIOR_PROFILE).family,'handle');
  for(const name of ['スタンド取付ボルト','メインスイッチ配線','チョークレバーブラケット','副変速','レバー','燃料キャップ(注記)ボルト'])
    assert.equal(proxyFor(name,dims,EXPANDED_PRIOR_PROFILE),null);
  assert.throws(()=>proxyFor('スタンド',dims,'guess-profile'),/unknown-prior-profile/);
});
test('two original regions retain 4/3 baseline anchors and gain separate expanded cameras',async()=>{
  const f=expandedRasterFixture(),before=structuredClone(f.machine);
  const a=await attachRasterRegions(f.machine,async()=>f.png),r=comparePriorProfiles(a.machine);
  assert.deepEqual(r.baseline.views.map(v=>v.count).sort(),[3,4]);
  assert.equal(r.baseline.counts.constrainedProxies,0);
  assert.deepEqual(r.expanded.views.map(v=>v.count).sort(),[6,9]);
  assert.equal(r.expanded.views.length,2);
  assert.ok(r.expanded.views.every(v=>v.status==='candidate'&&v.camera));
  assert.equal(r.expanded.acceptance.documented3dParts,0);
  assert.equal(r.report.acceptance.stageA3dPassed,false);
  assert.deepEqual(f.machine,before);
  for(const g of r.report.groups){assert.equal(g.commonTargets.baselineCameraRmsePx,null);
    assert.equal(g.baseline.status,'insufficient-anchors')}
});
test('new families never override endpoint, region or five-anchor requirements',()=>{
  const m=expandedSyntheticMachine();m.parts=m.parts.slice(-4);
  let r=comparePriorProfiles(m);assert.equal(r.expanded.counts.constrainedProxies,0);
  assert.equal(r.expanded.views[0].status,'insufficient-anchors');
  assert.equal(r.expanded.views[0].predictiveEvaluation.status,'not-calculated');
  m.parts[0].positionEvidence.basis='marker-centroid';delete m.parts[1].positionEvidence.viewRegion;
  r=comparePriorProfiles(m);assert.equal(r.expanded.counts.proxyParts,3);
  assert.equal(r.expanded.counts.unresolvedRegions,1);assert.equal(r.expanded.counts.constrainedProxies,0);
  assert.equal(r.expanded.unsplitControl[0].eligibleForReconstruction,false);
  assert.equal(r.expanded.unsplitControl[0].updates,undefined);
});
test('each camera and centroid prediction excludes the evaluated target',()=>{
  const m=expandedSyntheticMachine(),r=comparePriorProfiles(m),v=r.expanded.views[0];
  const d=v.predictiveEvaluation;assert.equal(d.status,'measured');
  assert.ok(d.cameraRmsePx<1e-7);assert.ok(d.centroidRmsePx>10);
  assert.equal(d.relativeToCentroid,'lower');assert.equal(d.documented3dParts,0);
  const f=d.folds[0];assert.ok(!f.trainingIds.includes(f.id));
  const target=m.parts.find(p=>p.id===f.id);
  target.positionEvidence.imageXY[0]+=150;
  const changed=comparePriorProfiles(m).expanded.views[0].predictiveEvaluation.folds.find(p=>p.id===f.id);
  assert.deepEqual(changed.heldOutPredictionXY,f.heldOutPredictionXY);
  assert.deepEqual(changed.centroidPredictionXY,f.centroidPredictionXY);
  assert.ok(changed.heldOutErrorPx>149);
});
test('v3 diagnostics agree with existing LOO arithmetic and include correct region normalization',()=>{
  const m=expandedSyntheticMachine(),v=comparePriorProfiles(m).expanded.views[0],d=v.predictiveEvaluation;
  assert.ok(Math.abs(d.cameraRmsePx-v.leaveOneOutRmsePx)<1e-8);
  assert.equal(d.cohorts.legacy.count,10);assert.equal(d.cohorts.added.count,8);
  const f=d.folds[0],train=f.trainingIds.map(id=>{
    const p=m.parts.find(p=>p.id===id);return {prior:proxyFor(p.name,dims,EXPANDED_PRIOR_PROFILE).geom.position,xy:p.positionEvidence.imageXY};
  });
  const p=m.parts.find(p=>p.id===f.id);
  assert.deepEqual(project(proxyFor(p.name,dims,EXPANDED_PRIOR_PROFILE).geom.position,fitCamera(train)),f.heldOutPredictionXY);
  assert.equal(d.cameraFractionOfRegionDiagonal,d.cameraRmsePx/Math.hypot(1000,800));
});
test('expanded categories do not manufacture real geometry, mutate input or depend on model name',()=>{
  const m=expandedSyntheticMachine(),before=structuredClone(m),a=comparePriorProfiles(m);
  assert.deepEqual(m,before);
  m.machineId='another-synthetic-machine';m.name='別の架空型式';
  const b=comparePriorProfiles(m);
  assert.deepEqual(a.expanded.variants,b.expanded.variants);
  for(const nodes of Object.values(a.expanded.variants))for(const n of nodes){
    assert.equal(n.shapeBasis,'category-proxy');
    const bounds=proxyFor(n.name,dims,EXPANDED_PRIOR_PROFILE).bounds;
    n.geom.position.forEach((v,k)=>assert.ok(v>=bounds[k][0]-1e-8&&v<=bounds[k][1]+1e-8));
  }
});
test('same input and reversed input ordering produce identical profiles and comparison',()=>{
  const m=expandedSyntheticMachine(),a=comparePriorProfiles(m),b=comparePriorProfiles(m);
  m.parts.reverse();assert.deepEqual(a,b);assert.deepEqual(a,comparePriorProfiles(m));
});
test('calculable candidates can fail to beat a centroid without being labelled verified',()=>{
  const m=expandedSyntheticMachine();let seed=17;
  const random=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
  for(const p of m.parts)p.positionEvidence.imageXY=[200+300*random(),200+300*random()];
  const r=comparePriorProfiles(m),v=r.expanded.views[0];
  assert.equal(v.status,'candidate');assert.equal(v.predictiveEvaluation.relativeToCentroid,'not-lower');
  assert.ok(v.predictiveEvaluation.cameraToCentroidRatio>=1);
  assert.equal(r.report.acceptance.stageA3dPassed,false);
  assert.equal(r.expanded.acceptance.documented3dParts,0);
});
