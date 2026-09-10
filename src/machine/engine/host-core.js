// Renderer lifecycle and lease arbitration. No Three or DOM imports.
export function createHostCore({loadBackend,requestFrame,cancelFrame,now,setDelay,clearDelay,idleMs=10000}) {
  let backend=null,loading=null,active=null,frame=null,idle=null,epoch=0,sequence=0,poster=null,inFrame=false,pipeline=Promise.resolve();
  const stopFrame=()=>{if(frame!==null)cancelFrame(frame);frame=null;};
  const stopIdle=()=>{if(idle!==null)clearDelay(idle);idle=null;};
  const idleLater=()=>{stopIdle();idle=setDelay(()=>{idle=null;if(!active)dispose();},idleMs);};
  function notify(fn,value){if(fn)try{fn(value);}catch(error){globalThis.console?.error(error);}}
  function release(reason='released') {
    stopFrame();const previous=active;active=null;
    try {if(previous)backend?.unmount();}
    finally {if(previous)notify(previous.options.onRelease,reason);idleLater();}
  }
  function fail(error) {
    const callback=active?.options.onError;
    dispose();notify(callback,error);
  }
  function schedule() {
    if(frame!==null||!active||inFrame)return;
    frame=requestFrame(time=>{
      frame=null;if(!active||!backend)return;
      inFrame=true;let more=false;
      try {more=backend.render(time);}catch(error){fail(error);}
      finally {inFrame=false;}
      if(more)schedule();
    });
  }
  function ensure() {
    if(backend)return Promise.resolve(backend);
    if(loading)return loading;
    const startEpoch=epoch;
    const task=pipeline.catch(()=>{}).then(async()=>{
      if(startEpoch!==epoch)return null;
      const value=await loadBackend();
      if(startEpoch!==epoch){value.dispose();return null;}
      backend=value;poster=poster||value.poster;return value;
    }).finally(()=>{if(loading===task)loading=null;});
    pipeline=task.catch(()=>{});
    loading=task;return task;
  }
  function dispose() {
    ++epoch;++sequence;loading=null;
    try {release('disposed');}finally {stopIdle();const old=backend;backend=null;old?.dispose();}
  }
  function acquire(container,options={}) {
    const token=++sequence;release('replaced');stopIdle();
    let cancelled=false;
    const ready=ensure().then(value=>{
      if(cancelled||token!==sequence||!value)return null;
      active={token,options};
      const valid=()=>active?.token===token;
      value.mount(container,options,{
        dirty:schedule,
        release:reason=>{if(valid())release(reason);},
        error:error=>{if(valid())fail(error);}
      });
      if(!valid())return null;
      const call=(name,...args)=>{if(!valid())return false;try{const result=value[name](...args,now());schedule();return result;}catch(error){fail(error);return false;}};
      schedule();
      return Object.freeze({
        focus:ref=>call('focus',ref),reset:()=>call('reset'),
        setScope:(id,explode=0)=>call('setScope',id,explode),
        select:ref=>call('select',ref),setDragMode:pan=>call('setDragMode',pan),
        release:()=>{if(valid())release();},
        get active(){return valid();}
      });
    }).catch(error=>{
      if(cancelled||token!==sequence)return null;
      // Include mount failures; clean up before invoking application callbacks.
      if(active?.token===token)fail(error);else{dispose();notify(options.onError,error);}
      return null;
    });
    return Object.freeze({ready,cancel(){cancelled=true;if(token===sequence){++sequence;release('cancelled');}}});
  }
  return {acquire,dispose,
    async getPoster(){if(poster)return poster;const value=await ensure();if(!active)idleLater();return value?.poster||null;},
    get state(){return {activeCount:active?1:0,rendererCount:backend?1:0,pendingFrame:frame!==null,loading:Boolean(loading)};}
  };
}
