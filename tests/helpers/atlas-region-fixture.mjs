// Synthetic raster only. No PC752N image, marker coordinates or dimensions are embedded here.
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { syntheticMachine } from './atlas-hypothesis-fixture.mjs';
const crc=data=>{let c=0xffffffff;for(const b of data){c^=b;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return(c^0xffffffff)>>>0};
const chunk=(type,body)=>{const head=Buffer.alloc(8),tail=Buffer.alloc(4);head.writeUInt32BE(body.length);head.write(type,4);tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4),body])));return Buffer.concat([head,body,tail]);};
export function pngFixture(gray,w,h,{filter=0,color=0,interlace=0}={}){
  const channels=color===2?3:1,raw=Buffer.alloc((w*channels+1)*h),ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=color;ihdr[12]=interlace;
  const pixels=Buffer.alloc(w*h*channels);for(let i=0;i<gray.length;i++)for(let c=0;c<channels;c++)pixels[i*channels+c]=gray[i];
  const stride=w*channels;
  for(let y=0;y<h;y++){
    raw[y*(stride+1)]=filter;
    for(let x=0;x<stride;x++){
      const a=x>=channels?pixels[y*stride+x-channels]:0,b=y?pixels[(y-1)*stride+x]:0,c=y&&x>=channels?pixels[(y-1)*stride+x-channels]:0;
      let predictor=0;if(filter===1)predictor=a;if(filter===2)predictor=b;if(filter===3)predictor=(a+b)>>1;
      if(filter===4){const p=a+b-c,ds=[Math.abs(p-a),Math.abs(p-b),Math.abs(p-c)];predictor=[a,b,c][ds.indexOf(Math.min(...ds))];}
      raw[y*(stride+1)+1+x]=(pixels[y*stride+x]-predictor)&255;
    }
  }
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
export function rasterFixture({close=false,bridge=false,single=false}={}){
  const w=320,h=240,gray=new Uint8Array(w*h).fill(255);
  const rect=(x0,y0,x1,y1)=>{for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)gray[y*w+x]=35;};
  rect(20,30,100,180);if(!single)rect(close?104:190,30,close?184:280,180);
  if(bridge)rect(90,100,210,102);
  rect(8,215,13,220); // Tiny label/noise: never a camera region.
  return {gray,w,h};
}
export function regionalMachine({recognized=7}={}){
  const raster=rasterFixture(),png=pngFixture(raster.gray,raster.w,raster.h),sha=createHash('sha256').update(png).digest('hex');
  const m=syntheticMachine(),names=m.parts.map(p=>p.name);m.parts=[];
  for(let i=0;i<25;i++){
    const left=i<4||(i>=recognized&&i%2===0),xy=[left?45+(i%3)*15:215+(i%3)*15,60+(i%5)*20];
    m.parts.push({id:`part-${String(i).padStart(2,'0')}`,name:i<recognized?names[i]:'未知の部品'+i,
      positionEvidence:{url:'fixture://two-regions',page:18,marker:i+1,figureSha256:sha,imageSize:[raster.w,raster.h],
        imageXY:xy,basis:i>=22?'marker-centroid':'leader-endpoint'}});
  }
  m.name='合成ラスタ / 実機ではありません';return {machine:m,png,raster};
}
