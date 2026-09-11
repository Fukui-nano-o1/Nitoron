// Opt-in paired camera experiment. Never replaces v3 reconstruction or modifies the original job.
import {readFile,mkdir,writeFile,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {attachRasterRegions,regionOverlaySvg} from './figure-regions.mjs';
import {compareCameraModels} from './camera-comparison.mjs';
import {buildCameraViewer} from './camera-viewer.mjs';
import {buildHypothesisViewer} from './viewer.mjs';
const args=process.argv.slice(2),sha=b=>createHash('sha256').update(b).digest('hex');
if(args.length!==3||args[1]!=='--out'){
 console.error('Usage: node scripts/atlas/experimental/run-cameras.mjs <original-job> --out <new-directory>');process.exit(2);
}
const start=performance.now();
try{
 const source=await realpath(resolve(args[0])),input=await readFile(join(source,'machine.json')),machine=JSON.parse(input);
 const inputHashes={'machine.json':sha(input)};
 const annotated=await attachRasterRegions(machine,async e=>{
  const file=`figure-p${e.page}.png`,bytes=await readFile(join(source,file));inputHashes[file]=sha(bytes);return bytes;
 });
 const {gridExperiment,report}=compareCameraModels(annotated.machine),images={};
 const regions=annotated.figures.map(({dataUri,...f})=>f);
 for(const f of annotated.figures)if(f.dataUri)images[f.figureKey]=f.dataUri;
 // These are the same display metadata as v3. The experiment itself is unchanged.
 gridExperiment.source={sha256:sha(input),file:'machine.json'};gridExperiment.regionAnalysis=regions;
 gridExperiment.variants.existing=structuredClone(machine.nodes??[]).filter(n=>n.geom);
 report.source={sha256:sha(input),inputHashes};
 const html=buildCameraViewer(report,images),gridHtml=await buildHypothesisViewer(gridExperiment,images);
 const output=resolve(args[2]);await mkdir(output,{recursive:false});await mkdir(join(output,'grid'));
 const save=(path,obj)=>writeFile(join(output,path),JSON.stringify(obj,null,2));
 await save('camera-comparison.json',report);await save('regions.json',regions);await save('grid/experiment.json',gridExperiment);
 await writeFile(join(output,'viewer.html'),html);await writeFile(join(output,'grid/viewer.html'),gridHtml);
 for(let i=0;i<annotated.figures.length;i++)await writeFile(join(output,`regions-${i+1}.svg`),regionOverlaySvg(annotated.figures[i]));
 for(const [file,expected]of Object.entries(inputHashes))if(sha(await readFile(join(source,file)))!==expected)throw Error('input-changed-during-run: '+file);
 const completed=report.groups.some(g=>g.folds.length&&g.folds.every(f=>f.affine.status==='fitted'));
 const status=completed?'comparison-completed':'no-complete-affine-loo';
 await save('run.json',{version:report.version,status,inputHashes,inputUnchanged:true,elapsedMs:performance.now()-start,
  externalApiCalls:0,runtimeModelSpecificManualInputs:0,documented3dParts:0,
  groups:report.groups.map(g=>({id:g.id,points:g.count,status:g.status,assessment:g.assessment})),
  notes:'Exit 0 means at least one complete affine LOO, not hypothesis acceptance. No 3D coordinates generated.'});
 console.log(JSON.stringify({output,status,groups:report.groups.map(g=>({id:g.id,count:g.count,assessment:g.assessment})),documented3dParts:0},null,2));
 if(!completed)process.exitCode=1;
}catch(error){console.error(error.message);process.exitCode=1;}
