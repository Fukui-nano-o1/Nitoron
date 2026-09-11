// Run in Nitoron after the original atlas job: node scripts/atlas/experimental/run.mjs <job-directory>
// Creates a SEPARATE directory, never modifies atlas input, application, database or network.
import { readFile,mkdir,writeFile,realpath } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { createHash } from 'node:crypto';
import { reconstructHypotheses } from './reconstruct.mjs';
import { buildHypothesisViewer } from './viewer.mjs';
import { attachRasterRegions,regionOverlaySvg } from './figure-regions.mjs';

const inputArg=process.argv[2],outIndex=process.argv.indexOf('--out');
if(!inputArg){console.error('Usage: node scripts/atlas/experimental/run.mjs <atlas-job-directory> [--out new-directory]');process.exit(2)}
const start=performance.now();
try{
  const source=await realpath(resolve(inputArg));
  const input=await readFile(join(source,'machine.json'));
  const machine=JSON.parse(input);
  const annotated=await attachRasterRegions(machine,e=>readFile(join(source,`figure-p${e.page}.png`)));
  const experiment=reconstructHypotheses(annotated.machine);
  experiment.regionAnalysis=annotated.figures.map(({dataUri,...f})=>f);
  experiment.source={sha256:createHash('sha256').update(input).digest('hex'),file:'machine.json'};
  experiment.variants.existing=structuredClone(machine.nodes??[]).filter(n=>n.geom);
  const images={},warnings=[];
  for(const f of annotated.figures){
    if(f.dataUri)images[f.figureKey]=f.dataUri;
    if(f.status!=='region-hypotheses')warnings.push({page:f.page,reason:f.status});
  }
  // Finish generation before reserving the output directory. Existing paths are never overwritten.
  const html=await buildHypothesisViewer(experiment,images);
  const output=resolve(outIndex>=0?process.argv[outIndex+1]:source+'-hypothesis-'+Date.now());
  await mkdir(output,{recursive:false});
  await writeFile(join(output,'experiment.json'),JSON.stringify(experiment,null,2));
  await writeFile(join(output,'viewer.html'),html);
  await writeFile(join(output,'regions.json'),JSON.stringify(experiment.regionAnalysis,null,2));
  for(let i=0;i<annotated.figures.length;i++)await writeFile(join(output,`regions-${i+1}.svg`),regionOverlaySvg(annotated.figures[i]));
  await writeFile(join(output,'run.json'),JSON.stringify({status:experiment.status,inputSha256:experiment.source.sha256,
    version:experiment.version,elapsedMs:performance.now()-start,externalApiCalls:0,
    runtimeModelSpecificManualInputs:0,warnings,notes:'Human development/review effort is NOT included; experiment only, not Stage A success'},null,2));
  console.log(JSON.stringify({output,status:experiment.status,counts:experiment.counts,documented3dParts:0,warnings},null,2));
  if(experiment.status!=='candidates-generated')process.exitCode=1;
}catch(error){console.error(error.message);process.exitCode=1;}
