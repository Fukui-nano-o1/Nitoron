import {writeFile,mkdir} from 'node:fs/promises';
import {createSKP as createBaseline} from '../baseline/skp-model.js';
import {createSKP} from '../src/skp-model.js';
import {AUTHORED_RADII_M} from '../src/wheel-spec.mjs';
import {measureModel,disposeModel} from '../src/measurement.mjs';
const models={baseline:createBaseline(),metricOnly:createSKP({wheelBodyRadiiM:AUTHORED_RADII_M}),metricWheels:createSKP()};
const report={schema:'skp-metric-review/1',baselineMain:'76fd603ec1156f8ff9b2a670d7bb6cda0de1a927',candidateRevision:'skp-101w-metric-candidate-1',
 acceptance:{softwareDimensionConventionOnly:true,physicalCompatibilityVerified:false,completeCatalogue99Percent:false,documented3dParts:0},
 stages:Object.fromEntries(Object.entries(models).map(([name,m])=>[name,measureModel(m)]))};
await mkdir(new URL('../evidence/',import.meta.url),{recursive:true});
await writeFile(new URL('../evidence/measurements.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
for(const [name,s]of Object.entries(report.stages))console.log(name,JSON.stringify({xyzMm:s.actual.xyzMm,wheels:s.wheels.map(w=>({id:w.id,diameter:w.circumscribedDiameterMm,ySpan:w.spanXYZmm[1],tireSpread:w.smoothTire.maxRadialSpreadMm,lowestY:w.lowestYmm}))}));
Object.values(models).forEach(disposeModel);
