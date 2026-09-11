import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeFigurePng,findRasterRegions,attachRasterRegions,regionOverlaySvg } from '../scripts/atlas/experimental/figure-regions.mjs';
import { reconstructHypotheses } from '../scripts/atlas/experimental/reconstruct.mjs';
import { pngFixture,rasterFixture,regionalMachine } from './helpers/atlas-region-fixture.mjs';

test('PNG matches grayscale/RGB bytes for all five standard filters',()=>{
  const gray=Uint8Array.from([0,200,3,55,128,6,77,254,9,10,22,12]);
  for(const color of [0,2])for(const filter of [0,1,2,3,4]){
    const decoded=decodeFigurePng(pngFixture(gray,4,3,{filter,color}));
    assert.deepEqual(decoded.gray,gray);assert.equal(decoded.w,4);assert.equal(decoded.h,3);
  }
});
test('corrupt/truncated/unsupported PNGs cannot silently supply camera regions',()=>{
  const png=pngFixture(Uint8Array.from([0,1,2,3]),2,2),corrupt=Buffer.from(png);corrupt[corrupt.length-5]^=1;
  assert.throws(()=>decodeFigurePng(corrupt),/crc/);
  assert.throws(()=>decodeFigurePng(png.subarray(0,png.length-2)),/truncated/);
  assert.throws(()=>decodeFigurePng(pngFixture(new Uint8Array(4),2,2,{interlace:1})),/unsupported/);
});
test('two separated ink drawings form stable hypotheses independently of anchor count',()=>{
  const r=findRasterRegions(rasterFixture());assert.equal(r.status,'region-hypotheses');assert.equal(r.regions.length,2);
  assert.notEqual(r.assign([50,80]).id,r.assign([230,80]).id);
  assert.equal(r.assign([10,217]).status,'unresolved');
});
test('nearby components that merge at a wider radius remain unresolved',()=>{
  const r=findRasterRegions(rasterFixture({close:true}));assert.equal(r.status,'unstable-region-merges');
  assert.equal(r.assign([50,80]).reason,'unstable-region-merge');
  assert.equal(r.assign([140,80]).reason,'unstable-region-merge');
});
test('one drawing, or two drawings joined by a thin line, are not assumed one camera',()=>{
  for(const option of [{single:true},{bridge:true}]){
    const r=findRasterRegions(rasterFixture(option));assert.equal(r.status,'single-or-no-region-unverified');
    assert.equal(r.assign([50,80]).status,'unresolved');
  }
});
test('background and invalid points are not forced into nearest drawing',()=>{
  const r=findRasterRegions(rasterFixture());assert.equal(r.assign([150,220]).reason,'no-region-at-point');
  assert.equal(r.assign([320,80]).reason,'invalid-point');assert.equal(r.assign([NaN,80]).reason,'invalid-point');
});
test('ALL 25 source points get region review before 7 shape priors are selected',async()=>{
  const{machine,png}=regionalMachine(),original=structuredClone(machine);let reads=0;
  const a=await attachRasterRegions(machine,async()=>{reads++;return png;});
  assert.equal(reads,1);assert.deepEqual(machine,original);assert.equal(a.figures[0].assignments.length,25);
  assert.equal(a.figures[0].assignments.filter(a=>a.status==='assigned').length,25);
  const r=reconstructHypotheses(a.machine);assert.equal(r.counts.proxyParts,7);assert.equal(r.counts.excluded,18);
  assert.deepEqual(r.views.map(v=>v.count).sort(),[3,4]);assert.equal(r.status,'insufficient-anchors');
  assert.equal(r.counts.constrainedProxies,0);assert.equal(r.acceptance.documented3dParts,0);
  assert.ok(r.views.every(v=>!v.camera&&!v.updates));
  assert.equal(r.unsplitControl[0].count,7);assert.equal(r.unsplitControl[0].eligibleForReconstruction,false);
  assert.equal(r.unsplitControl[0].updates,undefined);
});
test('no assignment is made after source checksum or dimensions mismatch',async()=>{
  const{machine,png}=regionalMachine();machine.parts.forEach(p=>p.positionEvidence.figureSha256='b'.repeat(64));
  const a=await attachRasterRegions(machine,async()=>png);assert.equal(a.figures[0].status,'figure-sha-mismatch');
  assert.equal(reconstructHypotheses(a.machine).status,'region-assignment-required');
  machine.parts.forEach(p=>{p.positionEvidence.figureSha256=createHash('sha256').update(png).digest('hex');p.positionEvidence.imageSize=[500,500];});
  const b=await attachRasterRegions(machine,async()=>png);assert.equal(b.figures[0].status,'figure-size-mismatch');
});
test('missing images override stale supplied viewRegion rather than trusting it',async()=>{
  const{machine}=regionalMachine();machine.parts.forEach(p=>p.positionEvidence.viewRegion={status:'assigned',id:'pretend-view'});
  const a=await attachRasterRegions(machine,async()=>{throw Object.assign(Error('missing'),{code:'ENOENT'})});
  assert.ok(a.machine.parts.every(p=>p.positionEvidence.viewRegion.status==='unresolved'));
  assert.equal(reconstructHypotheses(a.machine).counts.constrainedProxies,0);
});
test('same image and input produce the same annotated data and experiment three times',async()=>{
  const{machine,png}=regionalMachine(),results=[];
  for(let i=0;i<3;i++){const a=await attachRasterRegions(machine,async()=>png);results.push(JSON.stringify({figures:a.figures,experiment:reconstructHypotheses(a.machine)}));}
  assert.equal(new Set(results).size,1);
});
test('overlay contains every original marker including no-prior parts, with escaped names',async()=>{
  const{machine,png}=regionalMachine();machine.parts[24].name='</title><script>bad()</script>';
  const a=await attachRasterRegions(machine,async()=>png),svg=regionOverlaySvg(a.figures[0]);
  assert.equal((svg.match(/<circle /g)||[]).length,25);assert.ok(svg.includes('raster-1'));assert.ok(svg.includes('raster-2'));
  assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;script&gt;'));
});
test('valid five-plus-five groups can fit independently while no region IDs mix',async()=>{
  const{machine,png}=regionalMachine({recognized:10});
  // Move the fifth recognized part into the left drawing to produce exactly five anchors per view.
  machine.parts[4].positionEvidence.imageXY=[70,70];
  const a=await attachRasterRegions(machine,async()=>png),r=reconstructHypotheses(a.machine);
  assert.deepEqual(r.views.map(v=>v.count),[5,5]);assert.equal(r.counts.constrainedProxies,10);
  const map=new Map(a.machine.parts.map(p=>[p.id,p.positionEvidence.viewRegion.id]));
  for(const v of r.views)assert.deepEqual([...new Set(v.partIds.map(id=>map.get(id)))],[v.regionId]);
  assert.equal(r.acceptance.stageA3dPassed,false);
});
