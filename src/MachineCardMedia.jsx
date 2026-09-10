import React, { useEffect, useRef, useState } from 'react'
import { createPress } from './press-domain.js'
import { MACHINE_NAME } from './machine-domain.js'

// 3Dコードは修理カードが画面に入ってから動的importする。通常カードだけの一覧では読み込まない。
let hostImport = null
const loadHost = () => hostImport ||= import('./machine/engine/host.js')
export const HOLD_MS = 300, MOVE_SLOP = 8

// 修理カードの上部メディア。共有ホストの全体画像＋常時読める対象名を表示し、
// 約300msの長押し（PCはhover、キーボードは専用ボタン）で対象部品へのプレビューを重ねる。
// 短いタップは従来どおり詳細へ。ハート・バッジは親（RecordCard）側にあり、ここでは触れない。
export default function MachineCardMedia({ target, machineRef, href }) {
  const [poster, setPoster] = useState('') // '' = 読込前・失敗（文字表示）
  const [previewing, setPreviewing] = useState(false)
  const root = useRef(null), overlay = useRef(null)
  const press = useRef(null); press.current ||= createPress({ slop: MOVE_SLOP })
  const generation = useRef(0), request = useRef(null), timer = useRef(null)
  const zoomable = !!target.node // 有効な対象があるときだけズームする。未知・未選択は推測でズームしない。

  // 画面に入ってから共有の全体画像を取得する。失敗時は文字表示のまま。
  useEffect(() => {
    const element = root.current
    let cancelled = false
    const fetchPoster = async () => {
      try {
        const { getSharedMachineHost } = await loadHost()
        const image = await getSharedMachineHost().getPoster()
        if (!cancelled && image) setPoster(image)
      } catch { /* 文字表示へフォールバック */ }
    }
    if (typeof IntersectionObserver === 'undefined') { fetchPoster(); return () => { cancelled = true } }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { observer.disconnect(); fetchPoster() }
    })
    observer.observe(element)
    return () => { cancelled = true; observer.disconnect() }
  }, [])

  const endPreview = () => {
    generation.current++
    request.current?.cancel(); request.current = null
    setPreviewing(false)
  }
  const beginPreview = async () => {
    if (!zoomable || request.current) return
    const gen = ++generation.current
    setPreviewing(true)
    try {
      const { getSharedMachineHost } = await loadHost()
      // import完了までに指が離れた・別操作が始まった場合は開始しない。
      if (gen !== generation.current || !overlay.current) { if (gen === generation.current) setPreviewing(false); return }
      const active = getSharedMachineHost().acquire(overlay.current, {
        mode: 'card',
        onRelease: () => { if (gen === generation.current) { request.current = null; setPreviewing(false) } },
        onError: () => { if (gen === generation.current) { request.current = null; setPreviewing(false) } },
      })
      request.current = active
      const lease = await active.ready
      if (gen !== generation.current) { active.cancel(); return }
      if (lease) lease.focus(machineRef)
      else setPreviewing(false)
    } catch { if (gen === generation.current) setPreviewing(false) }
  }
  useEffect(() => endPreview, [])

  const clearHold = () => { clearTimeout(timer.current); timer.current = null }
  const down = e => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return
    press.current.down(e.pointerId, e.clientX, e.clientY)
    clearHold()
    if (e.pointerType !== 'mouse') timer.current = setTimeout(() => { if (press.current.fire(e.pointerId)) beginPreview() }, HOLD_MS)
  }
  const move = e => {
    const result = press.current.move(e.pointerId, e.clientX, e.clientY)
    if (result === 'cancel') clearHold()
    else if (result === 'cancel-preview') { clearHold(); endPreview() }
  }
  const up = e => {
    const result = press.current.up(e.pointerId)
    clearHold()
    if (result === 'end-preview') endPreview()
  }
  const abort = () => { const result = press.current.cancel(); clearHold(); if (result === 'end-preview') endPreview() }
  // 長押し発動直後のclickだけ抑止し、詳細への意図しない遷移を防ぐ。次の独立した短押しは有効。
  const click = e => { if (press.current.consumeClick()) { e.preventDefault(); e.stopPropagation() } }
  const hoverIn = e => { if (e.pointerType === 'mouse') beginPreview() }
  const hoverOut = e => { if (e.pointerType === 'mouse') { abort(); endPreview() } }

  return <div className="machine-media" ref={root}>
    {/* 長押しはプレビュー操作として使うため、機械メディア上ではcontextmenu（長押しメニュー）を抑止する。
        抑止しないとChromiumが約500msでpointercancelを発火し、プレビューが打ち切られる。 */}
    <a href={href} className="cover-link machine-press" onPointerDown={down} onPointerMove={move} onPointerUp={up}
      onPointerCancel={abort} onPointerEnter={hoverIn} onPointerLeave={hoverOut} onClickCapture={click}
      onContextMenu={e => e.preventDefault()} draggable={false}>
      <div className="record-cover machine-cover">
        {poster ? <img src={poster} alt={`${MACHINE_NAME}の全体`} draggable={false} />
          : <div className="cover-type"><span>{MACHINE_NAME}</span><strong>機械修理</strong><span>3D画像を準備中</span></div>}
        {/* 共有canvasの載せ先。hiddenで隠すとacquire時に0サイズ→即releaseされるため、常時サイズを持つ透明レイヤーにする。 */}
        <div className="machine-canvas-slot" ref={overlay} aria-hidden="true" />
      </div>
      <span className="machine-target-line">対象：{target.label}</span>
    </a>
    {zoomable && <button type="button" className="machine-preview-toggle print-hidden" aria-pressed={previewing}
      aria-label={previewing ? '対象部品のプレビューを終了' : '対象部品を3Dでプレビュー'}
      onClick={() => previewing ? endPreview() : beginPreview()}
      onKeyDown={e => { if (e.key === 'Escape') endPreview() }} onBlur={endPreview}>3D</button>}
  </div>
}
