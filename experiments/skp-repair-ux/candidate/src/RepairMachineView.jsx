import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MACHINE_NAME, NODES, ROOT_PART_ID, resolveMachineRef } from './machine-domain.js'
import { createRepairAnimation, repairScopePath } from './repair-animation.mjs'

// Read-only restoration from a saved reference. No new model version, renderer,
// persistence path or fallback machine is introduced by this surface.
export default function RepairMachineView({ machineRef, className = '' }) {
  const resolved = useMemo(() => resolveMachineRef(machineRef), [machineRef])
  const identity = JSON.stringify([machineRef?.machineId, machineRef?.modelVersion, machineRef?.partId])
  const [viewer, setViewer] = useState(resolved.node ? 'loading' : 'unsupported'), [attempt, setAttempt] = useState(0)
  const [help, setHelp] = useState(false), [pan, setPan] = useState(false), [playing, setPlaying] = useState(false)
  const [picked, setPicked] = useState(null)
  const container = useRef(null), leaseRef = useRef(null), animationRef = useRef(null), playRef = useRef(null)
  const stop = reason => { animationRef.current?.stop(reason); animationRef.current = null }

  useEffect(() => {
    let gone = false, request = null, motionPreference = null, removePreference = () => {}
    const node = resolveMachineRef(machineRef).node
    setPicked(null); setPan(false); setPlaying(false)
    if (!node) { setViewer('unsupported'); return }
    setViewer('loading')
    const play = reduced => {
      const lease = leaseRef.current
      if (gone || !lease?.active) return
      stop('restarted'); setPicked(null)
      const scopes = repairScopePath(NODES, node.id, ROOT_PART_ID)
      if (!scopes) { setViewer('unsupported'); return }
      animationRef.current = createRepairAnimation({
        lease, scopes, targetRef: machineRef,
        requestFrame: callback => requestAnimationFrame(callback), cancelFrame: id => cancelAnimationFrame(id), now: () => performance.now(),
        reducedMotion: reduced ?? motionPreference?.matches ?? false,
        onState: state => { if (!gone) { setPlaying(state === 'playing'); if (state === 'unavailable') setViewer('error') } },
      })
    }
    playRef.current = play
    ;(async () => {
      try {
        const { getSharedMachineHost } = await import('./machine/engine/host.js')
        if (gone || !container.current) return
        motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
        const preferenceChanged = () => { if (motionPreference.matches && animationRef.current?.running) play(true) }
        motionPreference.addEventListener('change', preferenceChanged)
        removePreference = () => motionPreference.removeEventListener('change', preferenceChanged)
        request = getSharedMachineHost().acquire(container.current, {
          mode: 'inspect',
          onPick: ref => {
            if (gone) return
            stop('interaction')
            const result = resolveMachineRef(ref)
            if (result.node && leaseRef.current?.select(ref)) setPicked(result.node.name)
          },
          onRelease: () => { stop('released'); leaseRef.current = null; if (!gone) { setPlaying(false); setViewer('paused') } },
          onError: () => { stop('error'); leaseRef.current = null; if (!gone) { setPlaying(false); setViewer('error') } },
        })
        const lease = await request.ready
        if (gone) { request.cancel(); return }
        if (!lease) { setViewer('error'); return }
        leaseRef.current = lease; setViewer('ready'); play()
      } catch { if (!gone) setViewer('error') }
    })()
    return () => {
      gone = true; stop('unmounted'); removePreference(); request?.cancel()
      leaseRef.current = null; playRef.current = null
    }
  }, [identity, attempt])

  const whole = () => { stop('whole'); setPicked(null); leaseRef.current?.setScope(ROOT_PART_ID, 0) }
  const interaction = () => { stop('interaction'); setPlaying(false) }
  const ready = viewer === 'ready' && !!resolved.node
  const name = resolved.node ? (resolved.node.id === ROOT_PART_ID ? MACHINE_NAME : resolved.node.name) : 'モデル未対応'
  const unavailable = resolved.status === 'unknown-machine' ? 'この機種の3Dは未対応です。' : '保存されたモデルを表示できません。'
  return <section className={`repair-machine-view ${className}`} aria-label="修理対象の3D">
    <div className="repair-machine-heading"><strong>{name}</strong>{resolved.node && resolved.node.id !== ROOT_PART_ID && <span>{MACHINE_NAME}</span>}</div>
    <div className="repair-machine-canvas" ref={container} role="group" aria-label={`${name}の3D。回転・拡大できます。`}
      style={{ height: 'clamp(280px, 52vh, 480px)', minHeight: 280, position: 'relative', borderRadius: 20, overflow: 'hidden', background: '#f6f6f4' }}
      onPointerDownCapture={interaction} onWheelCapture={interaction} onKeyDownCapture={interaction}>
      {!ready && <div className="machine-viewer-fallback" role="status">
        {!resolved.node ? unavailable : viewer === 'loading' ? '3Dを読み込み中' : viewer === 'paused' ? '3Dを再表示できます' : '3Dを表示できません'}
        {resolved.node && viewer !== 'loading' && <button type="button" onClick={() => setAttempt(value => value + 1)}>再表示</button>}
      </div>}
    </div>
    <div className="repair-machine-tools">
      <button type="button" disabled={!ready} onClick={whole}>全体</button>
      <button type="button" disabled={!ready || resolved.node?.id === ROOT_PART_ID} onClick={() => playRef.current?.()}>{playing ? 'もう一度' : '部品へ'}</button>
      <button type="button" aria-expanded={help} onClick={() => setHelp(value => !value)}>操作</button>
    </div>
    {picked && <p className="repair-machine-picked" role="status">{picked}</p>}
    {help && <div className="repair-machine-help">
      <p>ドラッグで回転、ピンチで拡大。部品をタップすると赤くなります。操作すると自動再生は止まります。</p>
      <div className="segmented" role="group" aria-label="ドラッグ操作">
        <button type="button" disabled={!ready} aria-pressed={!pan} onClick={() => { interaction(); setPan(false); leaseRef.current?.setDragMode(false) }}>回転</button>
        <button type="button" disabled={!ready} aria-pressed={pan} onClick={() => { interaction(); setPan(true); leaseRef.current?.setDragMode(true) }}>移動</button>
      </div>
      <p>分解は位置を見るための模式表示です。実際の整備順序・部品寸法は説明書で確認してください。</p>
    </div>}
  </section>
}
