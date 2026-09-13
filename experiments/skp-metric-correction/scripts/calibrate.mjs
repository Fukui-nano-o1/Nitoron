import {createSKP} from '../src/skp-model.js';
import {measureWheel,disposeModel} from '../src/measurement.mjs';
import {AUTHORED_RADII_M,NOMINAL_DIAMETERS_MM} from '../src/wheel-spec.mjs';
// Solve recipe parameters, not a mesh scale. The original tyre includes
// spline overshoot and fixed-height tread, so r is not the outer radius.
const radii={},trace={};
for(const kind of ['front','rear']){
 let lo=.1,hi=.3;const target=NOMINAL_DIAMETERS_MM[kind];
 for(let i=0;i<25;i++){
  const mid=(lo+hi)/2,m=createSKP({wheelBodyRadiiM:{...AUTHORED_RADII_M,[kind]:mid}});
  const diameter=measureWheel(m,kind+'L').circumscribedDiameterMm;disposeModel(m);
  if(diameter<target)lo=mid;else hi=mid;
 }
 radii[kind]=Number(((lo+hi)/2).toFixed(10));
 const m=createSKP({wheelBodyRadiiM:{...AUTHORED_RADII_M,[kind]:radii[kind]}});
 trace[kind]={targetMm:target,bodyRadiusM:radii[kind],measuredMm:measureWheel(m,kind+'L').circumscribedDiameterMm};disposeModel(m);
}
console.log(JSON.stringify({method:'25 deterministic bisection steps; no mesh scaling',radii,trace},null,2));
