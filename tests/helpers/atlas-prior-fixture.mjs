// Synthetic-only fixtures. No manufacturer image, 2D coordinates or real model dimensions.
import { syntheticMachine } from './atlas-hypothesis-fixture.mjs';
import { regionalMachine } from './atlas-region-fixture.mjs';
import { proxyFor,project } from '../../scripts/atlas/experimental/reconstruct.mjs';
import { EXTRA_PRIOR_FAMILIES,EXPANDED_PRIOR_PROFILE } from '../../scripts/atlas/experimental/prior-families.mjs';

export function expandedSyntheticMachine(){
  const m=syntheticMachine({offsetM:0}),camera={yawDeg:60,elevationDeg:25,scale:430,offset:[500,650]};
  for(const [i,d] of EXTRA_PRIOR_FAMILIES.entries()){
    const p=structuredClone(m.parts[0]);p.id=`added-${i}`;p.name=d.names[0];
    p.positionEvidence.imageXY=project(proxyFor(p.name,m.dimensionsMm,EXPANDED_PRIOR_PROFILE).geom.position,camera);
    m.parts.push(p);
  }
  return m;
}

export function expandedRasterFixture(){
  const f=regionalMachine();
  // New names are deliberately assigned to both synthetic ink regions, before v3 runs.
  // This tests plumbing and arithmetic, not validity of the category positions.
  const indexes=[8,10,12,14,16,7,9,11];
  EXTRA_PRIOR_FAMILIES.forEach((d,i)=>{f.machine.parts[indexes[i]].name=d.names[0]});
  return f;
}
