// Explicit opt-in v3 experiment. The original run.mjs remains baseline-v2.
import { readFile,mkdir,writeFile,realpath } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { createHash } from 'node:crypto';
import { comparePriorProfiles } from './prior-evaluation.mjs';
import { buildHypothesisViewer } from './viewer.mjs';
import { attachRasterRegions,regionOverlaySvg } from './figure-regions.mjs';

const args=process.argv.slice(2),inputArg=args[0],outIndex=args.indexOf('--out');
if(!inputArg||args.length!==3||outIndex!==1||!args[2]){
  console.error('Usage: node scripts/atlas/experimental/run-priors.mjs <original-job> --out <new-directory>');
  process.exit(2);
}
const start=performance.now();
try{
  const source=await realpath(resolve(inputArg)),input=await readFile(join(source,'machine.json'));
  const machine=JSON.parse(input),inputSha256=createHash('sha256').update(input).digest('hex');
  const annotated=await attachRasterRegions(machine,e=>readFile(join(source,`figure-p${e.page}.png`)));
  const {baseline,expanded,report}=comparePriorProfiles(annotated.machine);
  const regions=annotated.figures.map(({dataUri,...f})=>f),images={},warnings=[];
  for(const f of annotated.figures){
    if(f.dataUri)images[f.figureKey]=f.dataUri;
    if(f.status!=='region-hypotheses')warnings.push({page:f.page,reason:f.status});
  }
  for(const experiment of [baseline,expanded]){
    experiment.source={sha256:inputSha256,file:'machine.json'};
    experiment.regionAnalysis=regions;
    experiment.variants.existing=structuredClone(machine.nodes??[]).filter(n=>n.geom);
  }
  report.source=expanded.source;
  const baselineHtml=await buildHypothesisViewer(baseline,images);
  const html=await buildHypothesisViewer(expanded,images);
  const output=resolve(args[2]);
  await mkdir(output,{recursive:false});
  await mkdir(join(output,'baseline'),{recursive:false});
  const save=(path,data)=>writeFile(join(output,path),JSON.stringify(data,null,2));
  await save('experiment.json',expanded);await save('comparison.json',report);await save('regions.json',regions);
  await save('baseline/experiment.json',baseline);
  await writeFile(join(output,'viewer.html'),html);
  await writeFile(join(output,'baseline/viewer.html'),baselineHtml);
  for(let i=0;i<annotated.figures.length;i++)await writeFile(join(output,`regions-${i+1}.svg`),regionOverlaySvg(annotated.figures[i]));
  await save('run.json',{status:expanded.status,version:expanded.version,inputSha256,
    elapsedMs:performance.now()-start,externalApiCalls:0,runtimeModelSpecificManualInputs:0,warnings,
    notes:'Human prior design and review excluded from runtime intervention count; not Stage A success'});
  console.log(JSON.stringify({output,status:expanded.status,counts:report.counts,documented3dParts:0},null,2));
  if(expanded.status!=='candidates-generated')process.exitCode=1;
}catch(error){console.error(error.message);process.exitCode=1;}
