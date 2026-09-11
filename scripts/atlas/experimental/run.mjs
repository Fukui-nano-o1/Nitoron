// Run in Nitoron after the original atlas job: node scripts/atlas/experimental/run.mjs <job-directory>
// Creates a SEPARATE directory, never modifies atlas input, application, database or network.
import { readFile,mkdir,writeFile,realpath } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { createHash } from 'node:crypto';
import { reconstructHypotheses } from './reconstruct.mjs';
import { buildHypothesisViewer } from './viewer.mjs';

const inputArg=process.argv[2],outIndex=process.argv.indexOf('--out');
if(!inputArg){console.error('Usage: node scripts/atlas/experimental/run.mjs <atlas-job-directory> [--out new-directory]');process.exit(2)}
const start=performance.now();
try{
  const source=await realpath(resolve(inputArg));
  const input=await readFile(join(source,'machine.json'));
  const machine=JSON.parse(input),experiment=reconstructHypotheses(machine);
  experiment.source={sha256:createHash('sha256').update(input).digest('hex'),file:'machine.json'};
  experiment.variants.existing=structuredClone(machine.nodes??[]).filter(n=>n.geom);
  const images={},warnings=[];
  for(const key of new Set(experiment.views.map(v=>v.figureKey))){
    const[,page,sha]=JSON.parse(key);
    try{const bytes=await readFile(join(source,`figure-p${page}.png`));
      if(createHash('sha256').update(bytes).digest('hex')!==sha){warnings.push({page,reason:'figure-sha-mismatch'});continue;}
      images[key]='data:image/png;base64,'+bytes.toString('base64');
    }catch{warnings.push({page,reason:'source-figure-not-available'});}
  }
  // Finish generation before reserving the output directory. Existing paths are never overwritten.
  const html=await buildHypothesisViewer(experiment,images);
  const output=resolve(outIndex>=0?process.argv[outIndex+1]:source+'-hypothesis-'+Date.now());
  await mkdir(output,{recursive:false});
  await writeFile(join(output,'experiment.json'),JSON.stringify(experiment,null,2));
  await writeFile(join(output,'viewer.html'),html);
  await writeFile(join(output,'run.json'),JSON.stringify({status:experiment.status,inputSha256:experiment.source.sha256,
    version:experiment.version,elapsedMs:performance.now()-start,externalApiCalls:0,
    runtimeModelSpecificManualInputs:0,warnings,notes:'Human development/review effort is NOT included; experiment only, not Stage A success'},null,2));
  console.log(JSON.stringify({output,status:experiment.status,counts:experiment.counts,documented3dParts:0,warnings},null,2));
  if(experiment.status!=='candidates-generated')process.exitCode=1;
}catch(error){console.error(error.message);process.exitCode=1;}
