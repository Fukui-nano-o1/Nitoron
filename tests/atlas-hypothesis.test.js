import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraBasis,project,fitCamera,depthSegment,moveTowardObservation,proxyFor,reconstructHypotheses} from '../scripts/atlas/experimental/reconstruct.mjs';
import {syntheticMachine} from './helpers/atlas-hypothesis-fixture.mjs';
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

test('camera basis is orthogonal and projection cannot determine depth',()=>{
  const camera={yawDeg:60,elevationDeg:25,scale:400,offset:[100,200]},b=cameraBasis(60,25),p=[.1,.5,-.2];
  const q=p.map((v,i)=>v+.7*b.depth[i]);
  assert.ok(dist(project(p,camera),project(q,camera))<1e-9);
  assert.ok(dist(p,q)>.69);
});
test('camera fit recovers a synthetic camera projection without supplied angles',()=>{
  const m=syntheticMachine({offsetM:0});
  const obs=m.parts.map(p=>({prior:proxyFor(p.name,m.dimensionsMm).geom.position,xy:p.positionEvidence.imageXY}));
  const camera=fitCamera(obs);
  assert.ok(camera.rmse<1e-8);
  assert.equal(camera.yawDeg,60);assert.equal(camera.elevationDeg,25);
});
test('real input endpoint changes change the candidate, keeping input untouched',()=>{
  const m=syntheticMachine(),before=structuredClone(m),a=reconstructHypotheses(m);
  m.parts[0].positionEvidence.imageXY[0]+=75;
  const b=reconstructHypotheses(m);
  assert.notDeepEqual(a.variants.fitted.map(n=>n.geom.position),b.variants.fitted.map(n=>n.geom.position));
  const stable=structuredClone(before);reconstructHypotheses(before);assert.deepEqual(before,stable);
});
test('regularized fit reduces training error but does not claim 3D verification',()=>{
  const result=reconstructHypotheses(syntheticMachine());
  assert.equal(result.status,'candidates-generated');assert.ok(result.counts.constrainedProxies>=5);
  assert.ok(result.views[0].trainingRmseAfterPx<result.views[0].trainingRmseBeforePx);
  assert.equal(result.acceptance.stageA3dPassed,false);assert.equal(result.acceptance.documented3dParts,0);
  assert.ok(Number.isFinite(result.views[0].leaveOneOutRmsePx));
});
test('a corrupted held-out endpoint raises held-out error even when training can move parts',()=>{
  const m=syntheticMachine({offsetM:0}),clean=reconstructHypotheses(m);
  m.parts[0].positionEvidence.imageXY[0]+=190;
  const corrupt=reconstructHypotheses(m);
  assert.ok(corrupt.views[0].leaveOneOutRmsePx>clean.views[0].leaveOneOutRmsePx+10);
});
test('near/far alternatives have equal projection and different 3D positions',()=>{
  const r=reconstructHypotheses(syntheticMachine());
  const c=r.views[0].camera;
  const near=r.variants.depthNear[0].geom.position,far=r.variants.depthFar[0].geom.position;
  assert.ok(dist(project(near,c),project(far,c))<1e-8);
  assert.ok(dist(near,far)>.05);
});
test('all proxy meshes stay inside assumed exterior bounds in every variant',()=>{
  const m=syntheticMachine(),r=reconstructHypotheses(m);
  for(const nodes of Object.values(r.variants))for(const n of nodes){
    const bounds=proxyFor(n.name,m.dimensionsMm).bounds;
    n.geom.position.forEach((v,k)=>assert.ok(v>=bounds[k][0]-1e-8&&v<=bounds[k][1]+1e-8));
  }
});
test('legend marker positions are excluded, rather than converted into documented positions',()=>{
  const m=syntheticMachine();m.parts[0].positionEvidence.basis='marker-centroid';
  const r=reconstructHypotheses(m);assert.ok(!r.variants.fitted.some(n=>n.id===m.parts[0].id));
  assert.equal(r.excluded.find(n=>n.id===m.parts[0].id).reason,'no-usable-leader-endpoint');
});
test('missing or out-of-image evidence is rejected',()=>{
  const m=syntheticMachine();m.parts[0].positionEvidence.imageXY=[NaN,5];
  m.parts[1].positionEvidence.imageXY=[1001,5];delete m.parts[2].positionEvidence.url;
  const r=reconstructHypotheses(m);assert.equal(r.counts.excluded,3);
});
test('component names are not broadened into misleading parent geometries',()=>{
  assert.equal(proxyFor('ハンドル高さ調節レバー',[1600,700,1100]),null);
  assert.equal(proxyFor('燃料タンクキャップ',[1600,700,1100]),null);
});
test('different figure identities never share a camera',()=>{
  const m=syntheticMachine();for(const p of m.parts.slice(5))p.positionEvidence.page=2;
  const r=reconstructHypotheses(m);assert.equal(r.views.length,2);
  assert.notEqual(r.views[0].figureKey,r.views[1].figureKey);
});
test('missing region never falls back to fitting one camera to the entire image',()=>{
  const m=syntheticMachine();for(const p of m.parts)delete p.positionEvidence.viewRegion;
  const r=reconstructHypotheses(m);assert.equal(r.status,'region-assignment-required');
  assert.equal(r.views.length,0);assert.equal(r.counts.constrainedProxies,0);
  assert.equal(r.unsplitControl.length,1);assert.equal(r.unsplitControl[0].eligibleForReconstruction,false);
  assert.equal(r.unsplitControl[0].updates,undefined);
});
test('too few anchors stop fitting rather than manufacturing five successes',()=>{
  const m=syntheticMachine();m.parts=m.parts.slice(0,4);
  const r=reconstructHypotheses(m);assert.equal(r.status,'insufficient-anchors');assert.equal(r.counts.constrainedProxies,0);
});
test('duplicate IDs and unsupported geometry categories cannot silently pass',()=>{
  const m=syntheticMachine();m.parts[1].id=m.parts[0].id;assert.throws(()=>reconstructHypotheses(m),/duplicate/);
  assert.throws(()=>reconstructHypotheses({...syntheticMachine(),category:'tractor'}),/unsupported-category/);
  assert.throws(()=>reconstructHypotheses({...syntheticMachine(),dimensionsMm:[0,700,1100]}),/invalid-machine-dimensions/);
});
test('same JSON has deterministic output and input order does not change it',()=>{
  const m=syntheticMachine(),a=reconstructHypotheses(m);m.parts.reverse();
  assert.deepEqual(a,reconstructHypotheses(m));
});
test('degenerate camera and a ray outside its bounding box are rejected',()=>{
  assert.equal(fitCamera(Array.from({length:5},()=>({prior:[0,0,0],xy:[1,1]}))),null);
  assert.equal(depthSegment([2,0,0],[0,1,0],[[-1,1],[-1,1],[-1,1]]),null);
});
test('zero data residual does not move a prior position',()=>{
  const c={yawDeg:60,elevationDeg:25,scale:100,offset:[200,200]},prior=[.1,.5,.2];
  const u=moveTowardObservation({prior,xy:project(prior,c),bounds:[[-1,1],[0,1],[-1,1]]},c);
  assert.ok(dist(u.center,prior)<1e-12);
});
