import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostCore} from '../src/machine/engine/host-core.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function setup(load) {
  const frames=new Map(),timers=new Map(),instances=[];let id=0,time=0,alive=0,peak=0;
  const factory=()=>{
    alive++;peak=Math.max(peak,alive);
    const b={poster:'data:image/png;base64,test',container:null,hooks:null,disposed:false,mounts:0,renders:0,more:false,selected:null,
      mount(container,options,hooks){this.mounts++;this.container=container;this.hooks=hooks;if(options.fail)throw Error('mount failed');},
      unmount(){this.container=null;this.hooks=null;},render(){this.renders++;return this.more;},
      focus(ref){this.selected=ref;this.more=true;return ref;},reset(){this.selected=null;this.more=false;},
      setScope(id){this.selected=id;return true;},select(ref){this.selected=ref;return ref;},setDragMode(){},
      dispose(){if(!this.disposed){this.disposed=true;alive--;}}
    };instances.push(b);return b;
  };
  const host=createHostCore({loadBackend:()=>load?load(factory):factory(),requestFrame:fn=>{frames.set(++id,fn);return id;},cancelFrame:key=>frames.delete(key),now:()=>time,setDelay:fn=>{timers.set(++id,fn);return id;},clearDelay:key=>timers.delete(key)});
  return {host,instances,frames,timers,get alive(){return alive;},get peak(){return peak;},tick(){time+=16;const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(time);},expire(){const pending=[...timers.values()];timers.clear();for(const fn of pending)fn();}};
}

test('pending pointer cancellation never mounts a late model; competing requests choose the latest card',async()=>{
  const gate=deferred(),s=setup(async create=>{await gate.promise;return create();});
  const a=s.host.acquire('card-a');a.cancel();
  const b=s.host.acquire('card-b');gate.resolve();
  assert.equal(await a.ready,null);const lease=await b.ready;
  assert.ok(lease.active);assert.equal(s.instances.length,1);assert.equal(s.instances[0].container,'card-b');assert.equal(s.instances[0].mounts,1);
  s.host.dispose();
});

test('24 card transfers reuse one backend and one frame; a stale lease cannot release the new card',async()=>{
  const s=setup();let previous=null,released=0;
  for(let i=0;i<24;i++){
    const current=await s.host.acquire('card-'+i,{onRelease:()=>released++}).ready;
    previous?.release();assert.ok(current.active);current.focus({partId:String(i)});
    assert.equal(s.host.state.activeCount,1);assert.equal(s.frames.size,1);assert.equal(s.instances[0].container,'card-'+i);previous=current;
  }
  assert.equal(s.instances.length,1);assert.equal(s.peak,1);assert.equal(released,23);
  previous.release();assert.equal(s.frames.size,0);s.expire();assert.equal(s.alive,0);
});

test('settled rendering stops requesting frames and inactive time disposes backend',async()=>{
  const s=setup();await s.host.acquire('card').ready;
  s.tick();assert.equal(s.frames.size,0);
  s.instances[0].hooks.release('offscreen');assert.equal(s.host.state.activeCount,0);
  s.expire();assert.equal(s.host.state.rendererCount,0);assert.equal(s.alive,0);
});

test('all poster requests share one load; cached poster survives renderer disposal',async()=>{
  const s=setup();const posters=await Promise.all(Array.from({length:24},()=>s.host.getPoster()));
  assert.equal(new Set(posters).size,1);assert.equal(s.instances.length,1);assert.equal(s.frames.size,0);
  s.expire();assert.equal(s.alive,0);assert.equal(await s.host.getPoster(),posters[0]);assert.equal(s.instances.length,1);
});

test('dispose during asynchronous loading releases the old backend before constructing its replacement',async()=>{
  const gate=deferred();let calls=0;
  const s=setup(async create=>{if(++calls===1)await gate.promise;return create();});
  const first=s.host.acquire('old');await Promise.resolve();await Promise.resolve();
  s.host.dispose();const second=s.host.acquire('new');gate.resolve();
  assert.equal(await first.ready,null);assert.ok((await second.ready).active);
  assert.equal(s.peak,1);assert.equal(s.alive,1);s.host.dispose();assert.equal(s.alive,0);
});

test('loading failure reports one error and a later explicit retry works',async()=>{
  let calls=0,errors=0;const s=setup(create=>{if(++calls===1)throw Error('load failed');return create();});
  assert.equal(await s.host.acquire('card',{onError:()=>errors++}).ready,null);
  assert.equal(errors,1);assert.equal(s.frames.size,0);assert.ok((await s.host.acquire('retry').ready).active);s.host.dispose();
});

test('mount and context failures detach the old canvas and release resources before retry',async()=>{
  const s=setup();let errors=0;
  assert.equal(await s.host.acquire('bad',{fail:true,onError:()=>errors++}).ready,null);
  assert.equal(s.alive,0);assert.equal(errors,1);assert.equal(s.instances[0].container,null);
  const lease=await s.host.acquire('retry',{onError:()=>errors++}).ready;
  s.instances.at(-1).hooks.error(Error('WebGL context lost'));
  assert.equal(lease.active,false);assert.equal(s.alive,0);assert.equal(errors,2);assert.equal(s.frames.size,0);
  assert.ok((await s.host.acquire('last').ready).active);assert.equal(s.peak,1);s.host.dispose();
});

test('scroll, hidden tab, page exit and DOM removal release the active lease',async()=>{
  const s=setup();const reasons=[];
  for(const reason of ['offscreen','hidden','pagehide','detached']){
    const lease=await s.host.acquire(reason,{onRelease:r=>reasons.push(r)}).ready;
    lease.focus({partId:'engine'});s.instances[0].hooks.release(reason);
    assert.equal(lease.active,false);assert.equal(s.frames.size,0);
  }
  assert.deepEqual(reasons,['offscreen','hidden','pagehide','detached']);assert.equal(s.instances.length,1);s.host.dispose();
});
