import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog } from './ui.jsx'
import Icon from './Icon.jsx'
import { NODES, MACHINE_ID, MODEL_VERSION, ROOT_PART_ID, MACHINE_NAME, resolveMachineRef, resolveMachineTarget, MACHINE_SUBJECT } from './machine-domain.js'

const nodeMap = new Map(NODES.map(n => [n.id, n]))
const refOf = partId => ({ machineId: MACHINE_ID, partId, modelVersion: MODEL_VERSION })
const pathTo = id => { const path = []; for (let n = nodeMap.get(id); n; n = nodeMap.get(n.parent)) path.unshift(n); return path }
const within = (scopeId, id) => { for (let n = nodeMap.get(id); n; n = nodeMap.get(n.parent)) if (n.id === scopeId) return true; return false }

// 解体新書の選択ビュー。候補はローカル状態に持ち、「この部品を対象にする」で初めて onConfirm へ渡す。
// 閉じただけでは machineRef を書き換えない。readOnly（公開ページ・プレビュー）では確定の入口を出さない。
// 3D は共有ホスト（mode:'inspect'）を動的importで使い、失敗しても一覧から階層を辿って選択できる。
export default function MachinePicker({ value = null, readOnly = false, onConfirm, onClose }) {
  const resolution = useMemo(() => resolveMachineRef(value), [value])
  const unknown = ['unknown-machine', 'unknown-version', 'unknown-part', 'invalid'].includes(resolution.status)
  const [scope, setScope] = useState(() => resolution.node ? (resolution.node.parent || ROOT_PART_ID) : ROOT_PART_ID)
  const [candidate, setCandidate] = useState(() => resolution.node ? resolution.node.id : null)
  const [explode, setExplode] = useState(0)
  const [pan, setPan] = useState(false)
  const [viewer, setViewer] = useState('loading') // loading | ready | error
  const container = useRef(null), leaseRef = useRef(null), requestRef = useRef(null)
  const scopeNode = nodeMap.get(scope) || nodeMap.get(ROOT_PART_ID)
  const candidateNode = candidate ? nodeMap.get(candidate) : null

  // 3Dビューアの取得。unmount・閉じるで必ず cancel（disposeは他画面のカードも止めるため使わない）。
  useEffect(() => {
    let gone = false
    ;(async () => {
      try {
        const { getSharedMachineHost } = await import('./machine/engine/host.js')
        if (gone || !container.current) return
        const request = getSharedMachineHost().acquire(container.current, {
          mode: 'inspect',
          onPick: ref => { if (!gone && nodeMap.has(ref.partId)) setCandidate(ref.partId) },
          onRelease: () => { if (!gone) leaseRef.current = null },
          onError: () => { if (!gone) { leaseRef.current = null; setViewer('error') } },
        })
        requestRef.current = request
        const lease = await request.ready
        if (gone) { request.cancel(); return }
        if (!lease) { setViewer('error'); return }
        leaseRef.current = lease
        setViewer('ready')
      } catch { if (!gone) setViewer('error') }
    })()
    return () => { gone = true; requestRef.current?.cancel(); requestRef.current = null; leaseRef.current = null }
  }, [])
  // 階層・分解量を3Dへ反映し、候補が階層内なら強調を復元する。
  useEffect(() => {
    const lease = leaseRef.current
    if (!lease || viewer !== 'ready') return
    lease.setScope(scope, explode)
    if (candidate && within(scope, candidate)) lease.select(refOf(candidate))
  }, [viewer, scope, explode])
  useEffect(() => {
    const lease = leaseRef.current
    if (!lease || viewer !== 'ready' || !candidate) return
    lease.select(refOf(candidate))
  }, [viewer, candidate])
  useEffect(() => { leaseRef.current?.setDragMode(pan) }, [viewer, pan])

  const enter = node => { setScope(node.id); setExplode(0) }
  const label = candidateNode ? (candidateNode.id === ROOT_PART_ID ? `${MACHINE_NAME} · 機械全体` : `${MACHINE_NAME} · ${candidateNode.name}`) : '未選択'
  return <Dialog title={readOnly ? '解体新書で確認' : '機種と部品を選ぶ'} wide className="machine-picker" onClose={onClose}>
    <p className="hint">機種：{MACHINE_NAME}（クボタ・歩行型全自動野菜移植機）。モデルは外観近似・内部模式表現で、実部品寸法や整備上の分解順序を保証しません。</p>
    {unknown && <div className="notice" role="status">保存されている対象部品を確認できません（機種 {String(value?.machineId || '不明')} / 版 {String(value?.modelVersion || '不明')}）。選び直すまで保存済みの値は変更されません。</div>}
    <nav className="machine-breadcrumb" aria-label="部品の階層">
      {pathTo(scope).map((n, i, path) => <React.Fragment key={n.id}>
        {i > 0 && <span aria-hidden="true">›</span>}
        {i < path.length - 1 ? <button className="text-action" onClick={() => enter(n)}>{n.name}</button> : <strong>{n.name}</strong>}
      </React.Fragment>)}
    </nav>
    <div className="machine-picker-body">
      <div className="machine-viewer-pane">
        <div className="machine-viewer" ref={container} aria-label="3Dビューア">
          {viewer !== 'ready' && <div className="machine-viewer-fallback">{viewer === 'loading' ? '3Dを読み込み中…' : '3D表示を利用できません。右の一覧から選択できます。'}</div>}
        </div>
        <div className="machine-viewer-tools print-hidden">
          <div className="segmented" role="group" aria-label="ドラッグ操作">
            <button type="button" aria-pressed={!pan} onClick={() => setPan(false)}>回転</button>
            <button type="button" aria-pressed={pan} onClick={() => setPan(true)}>移動</button>
          </div>
          <label className="machine-explode">分解量<input type="range" min="0" max="1" step="0.05" value={explode} onChange={e => setExplode(Number(e.target.value))} /></label>
        </div>
      </div>
      <div className="machine-list-pane">
        <button type="button" className="machine-node-row machine-whole" aria-pressed={candidate === ROOT_PART_ID} onClick={() => setCandidate(ROOT_PART_ID)}>
          <Icon name={candidate === ROOT_PART_ID ? 'check' : 'plus'} size={15} />機械全体を対象にする
        </button>
        <h3 className="machine-list-head">{scopeNode.name} の構成</h3>
        <ul className="machine-node-list">
          {scopeNode.children.map(id => { const node = nodeMap.get(id); return <li key={id}>
            <button type="button" className="machine-node-row" aria-pressed={candidate === id} onClick={() => setCandidate(id)}>
              <Icon name={candidate === id ? 'check' : 'plus'} size={15} />{node.name}
            </button>
            {node.children.length > 0 && <button type="button" className="text-action machine-enter" onClick={() => enter(node)}>中を見る<Icon name="right" size={13} /></button>}
          </li> })}
        </ul>
      </div>
    </div>
    <div className="machine-picker-footer">
      <span className="machine-current" role="status">対象：{label}</span>
      {!readOnly && <button type="button" className="primary" disabled={!candidate} onClick={() => onConfirm(refOf(candidate))}>この部品を対象にする</button>}
    </div>
  </Dialog>
}

// 詳細・公開プレビューで共用する対象表示。閲覧専用で解体新書を開ける。
export function MachineTargetSection({ meta }) {
  const [open, setOpen] = useState(false)
  if (meta?.subject !== MACHINE_SUBJECT) return null
  const target = resolveMachineTarget(meta)
  return <div className="machine-target-section">
    <span className="machine-kicker">機械修理</span>
    <span>対象：{target.label || '機種・部品未選択'}</span>
    <button type="button" className="text-action print-hidden" onClick={() => setOpen(true)}>解体新書で確認</button>
    {open && <MachinePicker value={meta.machineRef} readOnly onClose={() => setOpen(false)} />}
  </div>
}
