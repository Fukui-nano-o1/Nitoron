// Experimental image-layout hypotheses. A connected ink region is NOT a proven camera view.
// Input is the original PNG already emitted by pdffigure. No network, OCR or model-specific coordinates.
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
export const REGION_METHOD='raster-components-v1';
export const imageKey=e=>JSON.stringify([e.url,e.page,e.figureSha256,...e.imageSize]);
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
const crc32=data=>{let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0};

// Deliberately limited to the encoder used in pdffigure: 8-bit gray/RGB, non-interlaced.
// Corrupt/unsupported PNGs stop region assignment; there is no whole-page-camera fallback.
export function decodeFigurePng(bytes) {
  if(!Buffer.isBuffer(bytes)||bytes.length<33||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('invalid-png');
  let header=null,ended=false,seenData=false,dataEnded=false;const chunks=[];
  for(let at=8;at<bytes.length;){
    if(at+12>bytes.length)throw Error('truncated-png');
    const size=bytes.readUInt32BE(at),end=at+12+size;
    if(end>bytes.length)throw Error('truncated-png');
    const type=bytes.toString('ascii',at+4,at+8),body=bytes.subarray(at+8,end-4);
    if(crc32(bytes.subarray(at+4,end-4))!==bytes.readUInt32BE(end-4))throw Error('png-crc-mismatch');
    if(!header&&type!=='IHDR')throw Error('invalid-png-order');
    if(type==='IHDR'){
      if(header||size!==13)throw Error('invalid-png-header');
      const w=body.readUInt32BE(0),h=body.readUInt32BE(4),color=body[9];
      if(!w||!h||w*h>32_000_000)throw Error('png-size-limit');
      if(body[8]!==8||![0,2].includes(color)||body[10]!==0||body[11]!==0||body[12]!==0)throw Error('unsupported-png');
      header={w,h,channels:color===2?3:1};
    }else if(type==='IDAT'){
      if(dataEnded)throw Error('invalid-png-order');chunks.push(body);seenData=true;
    }else if(type==='IEND'){
      if(size!==0||!seenData||end!==bytes.length)throw Error('invalid-png-end');ended=true;break;
    }else{
      if(type==='acTL'||type==='tRNS'||(type[0]===type[0].toUpperCase()&&type!=='PLTE'))throw Error('unsupported-png');
      if(seenData)dataEnded=true;
    }
    at=end;
  }
  if(!ended||!header)throw Error('truncated-png');
  const{w,h,channels:c}=header,stride=w*c,expected=(stride+1)*h;
  const raw=inflateSync(Buffer.concat(chunks),{maxOutputLength:expected});
  if(raw.length!==expected)throw Error('invalid-png-pixels');
  const pixels=Buffer.alloc(stride*h),gray=new Uint8Array(w*h);
  for(let y=0;y<h;y++){
    const filter=raw[y*(stride+1)];if(filter>4)throw Error('unsupported-png-filter');
    for(let x=0;x<stride;x++){
      const left=x>=c?pixels[y*stride+x-c]:0,up=y?pixels[(y-1)*stride+x]:0,ul=y&&x>=c?pixels[(y-1)*stride+x-c]:0;
      let predictor=0;
      if(filter===1)predictor=left;
      if(filter===2)predictor=up;
      if(filter===3)predictor=Math.floor((left+up)/2);
      if(filter===4){const p=left+up-ul,a=Math.abs(p-left),b=Math.abs(p-up),d=Math.abs(p-ul);predictor=a<=b&&a<=d?left:b<=d?up:ul;}
      pixels[y*stride+x]=(raw[y*(stride+1)+1+x]+predictor)&255;
    }
    for(let x=0;x<w;x++){const i=y*stride+x*c;gray[y*w+x]=c===1?pixels[i]:Math.round((pixels[i]+pixels[i+1]+pixels[i+2])/3);}
  }
  return {gray,w,h};
}

function dilate(mask,w,h,r){
  const out=new Uint8Array(mask.length);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){
    for(let yy=Math.max(0,y-r);yy<=Math.min(h-1,y+r);yy++)for(let xx=Math.max(0,x-r);xx<=Math.min(w-1,x+r);xx++)out[yy*w+xx]=1;
  }
  return out;
}
function components(mask,ink,w,h){
  const labels=new Int32Array(mask.length),queue=new Int32Array(mask.length),items=[];let label=0;
  for(let i=0;i<mask.length;i++)if(mask[i]&&!labels[i]){
    label++;let head=0,tail=1;queue[0]=i;labels[i]=label;
    const item={label,inkCells:0,bounds:[w,h,-1,-1],sample:null};
    while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);
      if(ink[p]){item.inkCells++;item.sample??=p;item.bounds=[Math.min(item.bounds[0],x),Math.min(item.bounds[1],y),Math.max(item.bounds[2],x),Math.max(item.bounds[3],y)];}
      for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++){
        const q=yy*w+xx;if(mask[q]&&!labels[q]){labels[q]=label;queue[tail++]=q;}
      }
    }
    items.push(item);
  }
  return {labels,items};
}

export function findRasterRegions({gray,w,h}){
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>32_000_000||gray?.length!==w*h)throw Error('invalid-raster');
  const step=Math.max(1,Math.ceil(Math.max(w,h)/640)),cw=Math.ceil(w/step),ch=Math.ceil(h/step),ink=new Uint8Array(cw*ch);
  for(let gy=0;gy<ch;gy++)for(let gx=0;gx<cw;gx++){
    let dark=0,total=0;
    for(let y=gy*step;y<Math.min(h,(gy+1)*step);y++)for(let x=gx*step;x<Math.min(w,(gx+1)*step);x++){total++;if(gray[y*w+x]<180)dark++;}
    ink[gy*cw+gx]=dark/total>=.08?1:0;
  }
  const base=components(dilate(ink,cw,ch,1),ink,cw,ch),coarse=components(dilate(ink,cw,ch,2),ink,cw,ch);
  const large=base.items.filter(c=>{const bw=c.bounds[2]-c.bounds[0]+1,bh=c.bounds[3]-c.bounds[1]+1;
    return bw>=cw*.06&&bh>=ch*.06&&bw*bh>=cw*ch*.005&&c.inkCells>=24;
  }).sort((a,b)=>a.bounds[1]-b.bounds[1]||a.bounds[0]-b.bounds[0]);
  const parentCounts=new Map();
  for(const c of large){const p=coarse.labels[c.sample];parentCounts.set(p,(parentCounts.get(p)||0)+1);}
  const regions=large.map((c,i)=>({id:`raster-${i+1}`,bounds:[c.bounds[0]*step,c.bounds[1]*step,Math.min(w,(c.bounds[2]+1)*step),Math.min(h,(c.bounds[3]+1)*step)],
    stable:parentCounts.get(coarse.labels[c.sample])===1,inkCells:c.inkCells,label:c.label}));
  // A single connected region may still contain two drawings joined by a line. Do not call it a known single view.
  const status=regions.length<2?'single-or-no-region-unverified':regions.every(r=>r.stable)?'region-hypotheses':'unstable-region-merges';
  const assign=xy=>{
    if(!Array.isArray(xy)||xy.length!==2||!xy.every(Number.isFinite)||xy[0]<0||xy[1]<0||xy[0]>=w||xy[1]>=h)return {status:'unresolved',reason:'invalid-point'};
    if(regions.length<2)return {status:'unresolved',reason:status};
    const x=Math.floor(xy[0]/step),y=Math.floor(xy[1]/step),hits=new Set();
    for(let yy=Math.max(0,y-2);yy<=Math.min(ch-1,y+2);yy++)for(let xx=Math.max(0,x-2);xx<=Math.min(cw-1,x+2);xx++)if(base.labels[yy*cw+xx])hits.add(base.labels[yy*cw+xx]);
    const candidates=regions.filter(r=>hits.has(r.label));
    if(candidates.length!==1)return {status:'unresolved',reason:candidates.length?'ambiguous-region':'no-region-at-point'};
    const r=candidates[0];
    if(!r.stable)return {status:'unresolved',reason:'unstable-region-merge'};
    return {status:'assigned',id:r.id,bounds:r.bounds.slice()};
  };
  return {status,method:REGION_METHOD,parameters:{step,grid:[cw,ch],inkThreshold:180,tileInkFraction:.08,dilationRadii:[1,2]},regions:regions.map(({label,...r})=>r),assign};
}

// Loads ALL source figure points before shape-prior filtering. Original JSON is kept untouched.
export async function attachRasterRegions(machine,loadPng){
  const copy=structuredClone(machine),buckets=new Map(),figures=[];
  for(const p of copy.parts??[]){const e=p.positionEvidence;if(!e)continue;
    delete e.viewRegion;
    if(!Array.isArray(e.imageSize)||e.imageSize.length!==2||!e.imageSize.every(Number.isFinite))continue;
    const key=imageKey(e);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p);
  }
  for(const key of [...buckets.keys()].sort()){
    const parts=buckets.get(key).sort((a,b)=>String(a.id).localeCompare(String(b.id))),e=parts[0].positionEvidence;
    let detector=null,error=null,dataUri=null;
    try{
      if(!Number.isInteger(e.page)||e.page<=0)throw Error('invalid-figure-page');
      const bytes=await loadPng(e),sha=createHash('sha256').update(bytes).digest('hex');
      if(sha!==e.figureSha256)throw Error('figure-sha-mismatch');
      const raster=decodeFigurePng(bytes);
      if(raster.w!==e.imageSize[0]||raster.h!==e.imageSize[1])throw Error('figure-size-mismatch');
      detector=findRasterRegions(raster);dataUri='data:image/png;base64,'+bytes.toString('base64');
    }catch(err){error=err.code==='ENOENT'?'source-figure-not-available':err.message;}
    const assignments=parts.map(p=>{
      const pe=p.positionEvidence,result=detector?detector.assign(pe.imageXY):{status:'unresolved',reason:error};
      pe.viewRegion={...result,method:REGION_METHOD,figureSha256:e.figureSha256};
      return {partId:p.id,name:p.name,marker:pe.marker,basis:pe.basis,xy:pe.imageXY,...result};
    });
    figures.push({figureKey:key,page:e.page,imageSize:e.imageSize.slice(),imageSha256:e.figureSha256,status:error??detector.status,
      method:REGION_METHOD,parameters:detector?.parameters??null,regions:detector?.regions??[],assignments,dataUri});
  }
  return {machine:copy,figures};
}

// Original figure + ALL points (also parts with no shape prior), for independent visual review.
export function regionOverlaySvg(figure){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const[w,h]=figure.imageSize,r=Math.max(w,h)/130,colors=['#d35400','#087f8c','#6c40a3','#145cca'];
  const color=id=>colors[Math.max(0,figure.regions.findIndex(q=>q.id===id))%colors.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Experimental region hypotheses, not verified views">`+
    (figure.dataUri?`<image href="${figure.dataUri}" width="${w}" height="${h}"/>`:'')+
    figure.regions.map(q=>{const[x0,y0,x1,y1]=q.bounds;return `<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="none" stroke="${color(q.id)}" stroke-width="${r/5}" stroke-dasharray="${q.stable?'0':r}"/><text x="${x0}" y="${Math.max(r,y0-r/3)}" fill="${color(q.id)}" font-size="${r}">${esc(q.id)}${q.stable?'':' / unstable'}</text>`}).join('')+
    figure.assignments.filter(a=>Array.isArray(a.xy)&&a.xy.length===2&&a.xy.every(Number.isFinite)).map(a=>`<g><title>${esc(a.name+' / '+(a.id??a.reason))}</title><circle cx="${a.xy[0]}" cy="${a.xy[1]}" r="${r/2}" fill="${a.status==='assigned'?color(a.id):'#cc0033'}" opacity=".75"/><text x="${a.xy[0]+r/2}" y="${a.xy[1]}" fill="#18252c" font-size="${r*.85}">${esc(a.marker??a.partId)}</text></g>`).join('')+'</svg>';
}
