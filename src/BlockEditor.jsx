import React, { useEffect, useRef, useState } from 'react'
import { textBlock } from './domain.js'
const Icon = {plus: '+', check: '✓'}
const SLASH_ITEMS = [
  { type: 'text', label: 'テキスト', desc: 'プレーンテキストで書き始めます。', badge: 'Aa', keys: 'text plain' },
  { type: 'h1', label: '見出し1', desc: '大サイズの見出しです。', badge: 'H1', keys: 'heading h1' },
  { type: 'h2', label: '見出し2', desc: '中サイズの見出しです。', badge: 'H2', keys: 'heading h2' },
  { type: 'h3', label: '見出し3', desc: '小サイズの見出しです。', badge: 'H3', keys: 'heading h3' },
  { type: 'bullet', label: '箇条書きリスト', desc: 'シンプルな箇条書きリストを作成します。', badge: '•', keys: 'bullet list' },
  { type: 'number', label: '番号付きリスト', desc: '番号付きのリストを作成します。', badge: '1.', keys: 'number list' },
  { type: 'todo', label: 'ToDoリスト', desc: 'チェックボックス付きのリストです。', badge: '☑', keys: 'todo check' },
  { type: 'quote', label: '引用', desc: '引用文を記載します。', badge: '❝', keys: 'quote' },
  { type: 'callout', label: 'コールアウト', desc: '文章を目立たせます。', badge: 'art:bulb', keys: 'callout' },
  { type: 'divider', label: '区切り線', desc: 'ブロックを視覚的に分割します。', badge: '—', keys: 'divider hr' },
]

const LIST_TYPES = ['bullet', 'number', 'todo']
const MD_SHORTCUTS = [['# ', 'h1'], ['## ', 'h2'], ['### ', 'h3'], ['- ', 'bullet'], ['* ', 'bullet'], ['1. ', 'number'], ['[] ', 'todo'], ['> ', 'quote']]

const resizeArea = (el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }

export default function BlockEditor({ blocks, onChange }) {
  const [menu, setMenu] = useState(null) // { blockId, index }
  const refs = useRef({})
  const [focusTo, setFocusTo] = useState(null) // { id, pos }

  useEffect(() => {
    if (focusTo) {
      const el = refs.current[focusTo.id]
      if (el) { el.focus(); const pos = focusTo.pos ?? el.value.length; el.setSelectionRange(pos, pos) }
      setFocusTo(null)
    }
  }, [focusTo, blocks])
  useEffect(() => { Object.values(refs.current).forEach(resizeArea) }, [blocks])
  const menuBlockId = menu?.blockId
  useEffect(() => { if (menuBlockId) refs.current[menuBlockId]?.scrollIntoView({ block: 'center' }) }, [menuBlockId])

  const commit = (next) => onChange(next.length ? next : [textBlock()])
  const patch = (id, p) => commit(blocks.map((b) => b.id === id ? { ...b, ...p } : b))
  const insertAfter = (id, block) => {
    const i = blocks.findIndex((b) => b.id === id)
    const next = [...blocks]; next.splice(i + 1, 0, block)
    commit(next); setFocusTo({ id: block.id, pos: 0 })
  }

  const menuQuery = menu ? (blocks.find((b) => b.id === menu.blockId)?.text || '').slice(1).toLowerCase() : ''
  const menuItems = menu ? SLASH_ITEMS.filter((s) => !menuQuery || s.label.toLowerCase().includes(menuQuery) || s.keys.includes(menuQuery)) : []

  const applyMenu = (item, block) => {
    setMenu(null)
    if (item.type === 'divider') {
      const after = textBlock()
      const i = blocks.findIndex((b) => b.id === block.id)
      const next = [...blocks]
      next[i] = { ...block, type: 'divider', text: '' }
      next.splice(i + 1, 0, after)
      commit(next); setFocusTo({ id: after.id, pos: 0 })
    } else {
      patch(block.id, { type: item.type, text: '', checked: false })
      setFocusTo({ id: block.id, pos: 0 })
    }
  }

  const handleChange = (block, value) => {
    if (value.startsWith('/')) { if (!menu || menu.blockId !== block.id) setMenu({ blockId: block.id, index: 0 }); else setMenu({ ...menu, index: 0 }) }
    else if (menu && menu.blockId === block.id) setMenu(null)

    if (block.type === 'text') {
      for (const [prefix, type] of MD_SHORTCUTS) {
        if (value === prefix) { patch(block.id, { type, text: '' }); setFocusTo({ id: block.id, pos: 0 }); return }
      }
      if (value === '---') {
        const after = textBlock()
        const i = blocks.findIndex((b) => b.id === block.id)
        const next = [...blocks]
        next[i] = { ...block, type: 'divider', text: '' }
        next.splice(i + 1, 0, after)
        commit(next); setFocusTo({ id: after.id, pos: 0 })
        return
      }
    }
    patch(block.id, { text: value })
  }

  const handleKeyDown = (e, block) => {
    if (e.nativeEvent.isComposing || e.isComposing || e.keyCode === 229) return
    if (menu && menu.blockId === block.id && menuItems.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMenu({ ...menu, index: (menu.index + 1) % menuItems.length }); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMenu({ ...menu, index: (menu.index - 1 + menuItems.length) % menuItems.length }); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyMenu(menuItems[Math.min(menu.index, menuItems.length - 1)], block); return }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMenu(null); return }
    }
    const el = e.target
    const i = blocks.findIndex((b) => b.id === block.id)

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (block.text === '' && LIST_TYPES.concat('quote', 'callout').includes(block.type)) { patch(block.id, { type: 'text' }); return }
      const caret = el.selectionStart
      const before = block.text.slice(0, caret)
      const rest = block.text.slice(caret)
      const nextType = LIST_TYPES.includes(block.type) ? block.type : 'text'
      const created = { ...textBlock(rest, nextType), checked: false }
      const next = blocks.map((b) => b.id === block.id ? { ...b, text: before } : b)
      next.splice(i + 1, 0, created)
      commit(next); setFocusTo({ id: created.id, pos: 0 })
      return
    }
    if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0) {
      if (block.type !== 'text') { e.preventDefault(); patch(block.id, { type: 'text' }); setFocusTo({ id: block.id, pos: 0 }); return }
      if (i > 0) {
        e.preventDefault()
        const prev = blocks[i - 1]
        if (prev.type === 'divider') { commit(blocks.filter((b) => b.id !== prev.id)); setFocusTo({ id: block.id, pos: 0 }); return }
        const pos = prev.text.length
        const next = blocks.filter((b) => b.id !== block.id).map((b) => b.id === prev.id ? { ...b, text: b.text + block.text } : b)
        commit(next); setFocusTo({ id: prev.id, pos })
      }
      return
    }
    if (e.key === 'ArrowUp' && el.selectionStart === 0 && i > 0) {
      const prev = [...blocks.slice(0, i)].reverse().find((b) => b.type !== 'divider')
      if (prev) { e.preventDefault(); setFocusTo({ id: prev.id }) }
      return
    }
    if (e.key === 'ArrowDown' && el.selectionStart === block.text.length && i < blocks.length - 1) {
      const nextB = blocks.slice(i + 1).find((b) => b.type !== 'divider')
      if (nextB) { e.preventDefault(); setFocusTo({ id: nextB.id, pos: 0 }) }
    }
  }

  let numberCount = 0
  return <div className="blocks">
    {blocks.map((block, i) => {
      numberCount = block.type === 'number' ? (blocks[i - 1]?.type === 'number' ? numberCount + 1 : 1) : 0
      const placeholder = block.type === 'h1' ? '見出し1' : block.type === 'h2' ? '見出し2' : block.type === 'h3' ? '見出し3'
        : blocks.length === 1 && i === 0 ? '入力するか、コマンドは半角「/」を押してください…' : ''
      return <div className="block-row" key={block.id}>
        <div className="handle">
          <button aria-label="ブロックを追加" onClick={() => insertAfter(block.id, textBlock())}>{Icon.plus}</button>
          <button aria-label="ブロックを上に移動" disabled={i === 0} onClick={() => { const next = [...blocks]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; commit(next) }}>↑</button>
        </div>
        {block.type === 'divider'
          ? <div className="b-divider"><hr /></div>
          : <div className={`b-wrap b-${block.type} ${block.type === 'todo' && block.checked ? 'done' : ''}`}>
              {block.type === 'bullet' && <span className="b-marker">•</span>}
              {block.type === 'number' && <span className="b-marker num">{numberCount}.</span>}
              {block.type === 'todo' && <button aria-label="完了を切り替え" aria-pressed={!!block.checked} className={`b-check ${block.checked ? 'on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => patch(block.id, { checked: !block.checked })}>{block.checked && Icon.check}</button>}
              {block.type === 'callout' && <span className="b-callout-ico"><span>!</span></span>}
              <textarea
                aria-label={`本文 ${i + 1}`}
                rows={1}
                ref={(el) => { refs.current[block.id] = el; resizeArea(el) }}
                value={block.text}
                placeholder={placeholder}
                onChange={(e) => handleChange(block, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, block)}
              />
            </div>}
        {menu && menu.blockId === block.id && <div className="slash-menu">
          <p className="slash-head">ベーシック</p>
          {menuItems.map((item, index) => <button
            key={item.type}
            className={`slash-item ${index === Math.min(menu.index, menuItems.length - 1) ? 'sel' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); applyMenu(item, block) }}
          >
            <span className="slash-badge">{item.badge.startsWith('art:') ? '!' : item.badge}</span>
            <span><span className="slash-label">{item.label}</span><span className="slash-desc">{item.desc}</span></span>
          </button>)}
          {!menuItems.length && <p className="slash-empty">結果はありません</p>}
        </div>}
      </div>
    })}
  </div>
}

