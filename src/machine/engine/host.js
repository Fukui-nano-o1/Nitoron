import {createHostCore} from './host-core.js';
let shared;

// Import this module dynamically from a machine-specific surface. One host per app.
export function getSharedMachineHost() {
  if(shared)return shared;
  if(typeof window==='undefined')throw new Error('Machine host requires a browser');
  shared=createHostCore({loadBackend:createBackend,requestFrame:callback=>requestAnimationFrame(callback),cancelFrame:id=>cancelAnimationFrame(id),now:()=>performance.now(),setDelay:(fn,ms)=>setTimeout(fn,ms),clearDelay:id=>clearTimeout(id)});
  return shared;
}

async function createBackend() {
  const [T,{createMachineScene},{OrbitControls},{configureInspectionControls,setInspectionDragMode},{MACHINE_ID,MODEL_VERSION}]=await Promise.all([
    import('../../../vendor/parts-lab/dist/vendor/three.module.js'),import('./scene.js'),
    import('../../../vendor/parts-lab/dist/vendor/OrbitControls.js'),import('../../../vendor/parts-lab/dist/camera-rig.js'),import('../catalog.js')
  ]);
  let renderer,engine,controls=null,container=null,callbacks=null,cleanup=[],mode='card',lost=false,disposed=false,viewport='',pointer=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  try {
    renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'default'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.outputColorSpace=T.SRGBColorSpace;
    engine=createMachineScene({reducedMotion:reduced.matches});
    renderer.setPixelRatio(1);renderer.setSize(512,512,false);renderer.render(engine.scene,engine.camera);
    const poster=renderer.domElement.toDataURL('image/png');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));
    const canvas=renderer.domElement;
    canvas.className='machine-shared-canvas';canvas.setAttribute('aria-hidden','true');
    Object.assign(canvas.style,{display:'block',width:'100%',height:'100%'});
    const listen=(object,type,fn)=>{object.addEventListener(type,fn);cleanup.push(()=>object.removeEventListener(type,fn));};
    function unmount() {
      const hooks=cleanup;cleanup=[];for(const fn of hooks)fn();
      controls?.dispose();controls=null;canvas.remove();container=null;callbacks=null;pointer=null;viewport='';
      engine.reset({now:performance.now(),instant:true});
    }
    function resize() {
      if(!container?.isConnected){callbacks?.release('detached');return;}
      const {width,height}=container.getBoundingClientRect();
      if(width<=0||height<=0){callbacks?.release('hidden');return;}
      const key=width+':'+height;if(key===viewport)return;viewport=key;
      renderer.setSize(width,height,false);engine.resize(width,height);controls?.target.copy(engine.target);callbacks?.dirty();
    }
    function mount(element,options,hooks) {
      unmount();
      if(!element?.isConnected)throw new Error('Machine host container is detached');
      if(lost||disposed)throw new Error('Machine renderer is unavailable');
      container=element;callbacks=hooks;mode=options.mode==='inspect'?'inspect':'card';
      canvas.style.pointerEvents=mode==='inspect'?'auto':'none';canvas.style.touchAction=mode==='inspect'?'none':'pan-x pan-y';
      element.appendChild(canvas);engine.setReducedMotion(reduced.matches);resize();
      if(!container)return;
      if(mode==='inspect') {
        controls=new OrbitControls(engine.camera,canvas);configureInspectionControls(controls,true);controls.target.copy(engine.target);
        const dirty=()=>hooks.dirty(),start=()=>engine.stopCameraMotion();
        controls.addEventListener('change',dirty);controls.addEventListener('start',start);
        cleanup.push(()=>{controls?.removeEventListener('change',dirty);controls?.removeEventListener('start',start);});
        listen(canvas,'pointerdown',e=>{pointer=e.isPrimary?{id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now()}:null;});
        listen(canvas,'pointermove',e=>{if(pointer&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>6)pointer=null;});
        listen(canvas,'pointercancel',()=>{pointer=null;});
        listen(canvas,'pointerup',e=>{
          const p=pointer;pointer=null;if(!p||p.id!==e.pointerId||performance.now()-p.time>600)return;
          const b=canvas.getBoundingClientRect();
          const id=engine.pick((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2);
          if(id)options.onPick?.({machineId:MACHINE_ID,modelVersion:MODEL_VERSION,partId:id});
        });
      }
      if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(resize);observer.observe(element);cleanup.push(()=>observer.disconnect());}
      if(typeof IntersectionObserver!=='undefined'){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>!e.isIntersecting))hooks.release('offscreen');});observer.observe(element);cleanup.push(()=>observer.disconnect());}
      if(typeof MutationObserver!=='undefined'){const observer=new MutationObserver(()=>{if(!element.isConnected)hooks.release('detached');});observer.observe(document.documentElement,{childList:true,subtree:true});cleanup.push(()=>observer.disconnect());}
      listen(document,'visibilitychange',()=>{if(document.hidden)hooks.release('hidden');});
      listen(window,'pagehide',()=>hooks.release('pagehide'));
      listen(reduced,'change',()=>{engine.setReducedMotion(reduced.matches);hooks.dirty();});
    }
    const contextLost=e=>{e.preventDefault();lost=true;callbacks?.error(new Error('WebGL context lost'));};
    canvas.addEventListener('webglcontextlost',contextLost);
    return {poster,mount,unmount,
      render(now){if(!container)return false;if(!container.isConnected||document.hidden){callbacks?.release('hidden');return false;}const animated=engine.update(now),moving=controls?.update()||false;renderer.render(engine.scene,engine.camera);return animated||moving;},
      focus(ref,now){if(controls)controls.enabled=false;return engine.focus(ref,{now});},
      reset(now){engine.reset({now,instant:mode==='inspect'});if(controls){controls.enabled=true;controls.target.copy(engine.target);}},
      setScope(id,explode,now){const ok=engine.setScope(id,{explode,now});if(controls){controls.enabled=true;controls.target.copy(engine.target);controls.update();}return ok;},
      select(ref,now){return engine.selectInScope(ref,{now});},
      setDragMode(pan){if(controls)setInspectionDragMode(controls,Boolean(pan));},
      dispose(){if(disposed)return;disposed=true;unmount();canvas.removeEventListener('webglcontextlost',contextLost);engine.dispose();renderer.dispose();if(!lost)renderer.forceContextLoss();}
    };
  } catch(error) {controls?.dispose();engine?.dispose();renderer?.dispose();renderer?.forceContextLoss();throw error;}
}
