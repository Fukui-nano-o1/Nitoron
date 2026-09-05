import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase } from './supabase.js'
import './styles.css'

const uid = () => crypto.randomUUID()
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '')
const today = () => new Date().toISOString().slice(0, 10)
const textBlock = (text = '', type = 'text') => ({ id: uid(), type, text })
const noteText = (note) => (note.blocks || []).map((b) => b.text).filter(Boolean).join(' ')

const makeInitialNotes = () => [
  { id: uid(), title: 'はじめてのメモ', blocks: [textBlock('写真・数字・文章など、気づいたことをそのまま残します。')], category: '日常', date: '2026-09-03', type: 'メモ' },
  { id: uid(), title: 'レポートの下書きをつくる', blocks: [textBlock('メモをつなげて、伝わる形にまとめます。')], category: '仕事', date: '2026-09-02', type: 'アイデア' },
]

const rowFromNote = (note) => ({ id: note.id, title: note.title, category: note.category, type: note.type, date: note.date, blocks: note.blocks })
const noteFromRow = (row) => ({ id: row.id, title: row.title || '', category: row.category || '未分類', type: row.type || 'メモ', date: (row.date || today()).slice(0, 10), blocks: Array.isArray(row.blocks) && row.blocks.length ? row.blocks : [textBlock()] })

const PAGES = [
  { id: 'home', art: 'home', label: 'ホーム', title: 'ホーム', cover: 'linear-gradient(120deg,#d9e8dc,#eef3e6 55%,#f6f1e3)' },
  { id: 'notes', art: 'memo', label: 'メモ', title: 'メモ', cover: 'linear-gradient(120deg,#cfe3d8,#dcebe2 50%,#eef5ec)' },
  { id: 'report', art: 'report', label: 'レポート', title: 'レポート', cover: 'linear-gradient(120deg,#e3dccf,#efe9da 55%,#f7f4ea)' },
]

const TYPE_COLORS = { 'メモ': 'tag-blue', 'アイデア': 'tag-yellow', 'タスク': 'tag-green' }

const Icon = {
  search: <svg viewBox="0 0 20 20" width="18" height="18"><path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.65 3.64a.75.75 0 1 1-1.06 1.06l-3.65-3.64A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>,
  plus: <svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M8 2.5c.41 0 .75.34.75.75v4h4a.75.75 0 0 1 0 1.5h-4v4a.75.75 0 0 1-1.5 0v-4h-4a.75.75 0 0 1 0-1.5h4v-4c0-.41.34-.75.75-.75Z"/></svg>,
  chevronsLeft: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M7.28 3.97a.75.75 0 0 1 0 1.06L4.31 8l2.97 2.97a.75.75 0 1 1-1.06 1.06l-3.5-3.5a.75.75 0 0 1 0-1.06l3.5-3.5a.75.75 0 0 1 1.06 0Zm5.5 0a.75.75 0 0 1 0 1.06L9.81 8l2.97 2.97a.75.75 0 1 1-1.06 1.06l-3.5-3.5a.75.75 0 0 1 0-1.06l3.5-3.5a.75.75 0 0 1 1.06 0Z"/></svg>,
  menu: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M2 4.25c0-.41.34-.75.75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.25Zm0 3.75c0-.41.34-.75.75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm.75 3a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H2.75Z"/></svg>,
  dots: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M3.5 8a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm5.75 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0ZM13.75 9.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"/></svg>,
  star: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 1.75a.6.6 0 0 1 .54.34l1.68 3.53 3.87.5a.6.6 0 0 1 .33 1.03l-2.83 2.68.72 3.83a.6.6 0 0 1-.87.64L8 12.44 4.56 14.3a.6.6 0 0 1-.87-.64l.72-3.83-2.83-2.68a.6.6 0 0 1 .33-1.03l3.87-.5L7.46 2.1A.6.6 0 0 1 8 1.75Zm0 2.02L6.74 6.42a.6.6 0 0 1-.46.33l-2.9.38 2.12 2a.6.6 0 0 1 .18.55l-.54 2.88 2.58-1.4a.6.6 0 0 1 .57 0l2.58 1.4-.55-2.88a.6.6 0 0 1 .18-.55l2.13-2-2.9-.38a.6.6 0 0 1-.47-.33L8 3.77Z"/></svg>,
  comment: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 2c3.59 0 6.5 2.39 6.5 5.5S11.59 13 8 13c-.61 0-1.2-.07-1.76-.2l-2.66 1.4a.55.55 0 0 1-.8-.57l.36-2.3C2.06 10.4 1.5 9 1.5 7.5 1.5 4.39 4.41 2 8 2Zm0 1.5c-2.9 0-5 1.86-5 4 0 1.14.55 2.2 1.55 2.96l.36.28-.26 1.68 1.9-1 .33.1c.35.09.73.14 1.12.14 2.9 0 5-1.86 5-4s-2.1-4-5-4Z"/></svg>,
  table: <svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2.5 3.25c0-.41.34-.75.75-.75h9.5c.41 0 .75.34.75.75v9.5c0 .41-.34.75-.75.75h-9.5a.75.75 0 0 1-.75-.75v-9.5ZM4 4v2h3.25V4H4Zm4.75 0v2H12V4H8.75ZM4 7.5v2h3.25v-2H4Zm4.75 0v2H12v-2H8.75ZM4 11v1h3.25v-1H4Zm4.75 0v1H12v-1H8.75Z"/></svg>,
  text: <svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2.75 3h10.5a.75.75 0 0 1 0 1.5h-4.5v8.75a.75.75 0 0 1-1.5 0V4.5h-4.5a.75.75 0 0 1 0-1.5Z"/></svg>,
  tag: <svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M8.69 1.5c.4 0 .78.16 1.06.44l4.31 4.31a1.5 1.5 0 0 1 0 2.12l-5.69 5.69a1.5 1.5 0 0 1-2.12 0L1.94 9.75a1.5 1.5 0 0 1-.44-1.06V3a1.5 1.5 0 0 1 1.5-1.5h5.69Zm0 1.5H3v5.69l4.31 4.31L13 7.31 8.69 3ZM5.5 4.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/></svg>,
  calendar: <svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M5.25 1.5c.41 0 .75.34.75.75V3h4v-.75a.75.75 0 0 1 1.5 0V3h1a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-8A1.5 1.5 0 0 1 3.5 3h1v-.75c0-.41.34-.75.75-.75ZM3.5 6.5v6h9v-6h-9Z"/></svg>,
  page: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M4.5 1.5h5.09c.4 0 .78.16 1.06.44l2.41 2.41c.28.28.44.66.44 1.06v8.09a1.5 1.5 0 0 1-1.5 1.5h-7.5a1.5 1.5 0 0 1-1.5-1.5v-10a1.5 1.5 0 0 1 1.5-1.5ZM4.5 3v10.5H12V5.62L9.38 3H4.5Zm1.25 5.5h4.5a.62.62 0 1 1 0 1.25h-4.5a.62.62 0 0 1 0-1.25Zm0 2.5h3a.62.62 0 1 1 0 1.25h-3a.62.62 0 0 1 0-1.25Z"/></svg>,
  chevronDown: <svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M3.97 5.72a.75.75 0 0 1 1.06 0L8 8.69l2.97-2.97a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 0-1.06Z"/></svg>,
  home: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M7.53 1.72a.75.75 0 0 1 .94 0l5.75 4.6a.75.75 0 0 1 .28.58v6.35a1.25 1.25 0 0 1-1.25 1.25H9.75a.75.75 0 0 1-.75-.75V10.5h-2v3.25a.75.75 0 0 1-.75.75H2.75A1.25 1.25 0 0 1 1.5 13.25V6.9a.75.75 0 0 1 .28-.58l5.75-4.6ZM3 7.26v5.74h2.5V9.75A.75.75 0 0 1 6.25 9h3.5a.75.75 0 0 1 .75.75V13H13V7.26L8 3.26 3 7.26Z"/></svg>,
  inbox: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M3.9 2.5h8.2c.62 0 1.17.38 1.4.95l1.4 3.5c.07.18.1.36.1.55v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12V7.5c0-.19.03-.37.1-.55l1.4-3.5c.23-.57.78-.95 1.4-.95ZM3.9 4 2.7 7h2.8a.75.75 0 0 1 .67.41l.55 1.09h2.56l.55-1.09A.75.75 0 0 1 10.5 7h2.8L12.1 4H3.9ZM2.5 8.5V12h11V8.5h-2.54l-.55 1.09a.75.75 0 0 1-.66.41h-3.5a.75.75 0 0 1-.66-.41L5.04 8.5H2.5Z"/></svg>,
  trash: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M6.5 1.75h3c.41 0 .75.34.75.75v.75h3a.75.75 0 0 1 0 1.5h-.56l-.65 8.42A1.5 1.5 0 0 1 10.55 14.5h-5.1a1.5 1.5 0 0 1-1.5-1.33L3.31 4.75h-.56a.75.75 0 0 1 0-1.5h3V2.5c0-.41.34-.75.75-.75Zm-1.68 3 .62 8.25h5.12l.62-8.25H4.82ZM6.75 6.5c.28 0 .5.22.5.5v4a.5.5 0 0 1-1 0V7c0-.28.22-.5.5-.5Zm2.5 0c.28 0 .5.22.5.5v4a.5.5 0 0 1-1 0V7c0-.28.22-.5.5-.5Z"/></svg>,
  gear: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M6.9 1.5h2.2c.34 0 .63.23.72.56l.34 1.31c.36.15.7.35 1.01.58l1.3-.37a.75.75 0 0 1 .85.35l1.1 1.9a.75.75 0 0 1-.13.92l-.96.93a4.9 4.9 0 0 1 0 1.17l.96.93c.25.24.3.62.13.92l-1.1 1.9a.75.75 0 0 1-.85.35l-1.3-.37c-.31.23-.65.43-1.01.58l-.34 1.3a.75.75 0 0 1-.72.57H6.9a.75.75 0 0 1-.72-.56l-.34-1.31a5.1 5.1 0 0 1-1.01-.58l-1.3.37a.75.75 0 0 1-.85-.35l-1.1-1.9a.75.75 0 0 1 .13-.92l.96-.93a4.9 4.9 0 0 1 0-1.17l-.96-.93a.75.75 0 0 1-.13-.92l1.1-1.9a.75.75 0 0 1 .85-.35l1.3.37c.31-.23.65-.43 1.01-.58l.34-1.3a.75.75 0 0 1 .72-.57ZM8 5.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/></svg>,
  clock: <svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" d="M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 1.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 1.25c.41 0 .75.34.75.75v2.69l1.78 1.78a.75.75 0 1 1-1.06 1.06l-2-2A.75.75 0 0 1 7.25 8V5c0-.41.34-.75.75-.75Z"/></svg>,
  sparkle: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 1.25c.3 0 .57.18.68.46l1.1 2.74 2.74 1.1a.73.73 0 0 1 0 1.36l-2.74 1.1-1.1 2.74a.73.73 0 0 1-1.36 0l-1.1-2.74-2.74-1.1a.73.73 0 0 1 0-1.36l2.74-1.1 1.1-2.74A.73.73 0 0 1 8 1.25Zm5 8.25c.26 0 .49.16.58.4l.55 1.47 1.47.55a.62.62 0 0 1 0 1.16l-1.47.55-.55 1.47a.62.62 0 0 1-1.16 0l-.55-1.47-1.47-.55a.62.62 0 0 1 0-1.16l1.47-.55.55-1.47c.09-.24.32-.4.58-.4Z"/></svg>,
  book: <svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" d="M4.25 1.5h8.25c.41 0 .75.34.75.75v11.5a.75.75 0 0 1-.75.75H4.25A2.25 2.25 0 0 1 2 12.25v-8.5A2.25 2.25 0 0 1 4.25 1.5ZM3.5 12.25c0 .41.34.75.75.75h7.5v-2H4.25a.75.75 0 0 0-.75.75v.5Zm8.25-2.75V3H4.25a.75.75 0 0 0-.75.75v5.88c.24-.08.49-.13.75-.13h7.5Z"/></svg>,
  checkbox: <svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" d="M3.5 2h9A1.5 1.5 0 0 1 14 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2Zm0 1.5v9h9v-9h-9Zm7.53 2.47a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06l.97.97 2.47-2.47a.75.75 0 0 1 1.06 0Z"/></svg>,
  check: <svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M13.53 4.22a.75.75 0 0 1 0 1.06l-6.5 6.5a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47 5.97-5.97a.75.75 0 0 1 1.06 0Z"/></svg>,
  user: <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 1.75a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5Zm0 1.5a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5ZM8 9.5c2.76 0 5.25 1.44 5.25 3.55v.2a.75.75 0 0 1-.75.75h-9a.75.75 0 0 1-.75-.75v-.2C2.75 10.94 5.24 9.5 8 9.5Zm0 1.5c-2.02 0-3.4.88-3.68 1.5h7.36c-.28-.62-1.66-1.5-3.68-1.5Z"/></svg>,
}

/* ---------- Hand-drawn duotone artwork (Nitoron's own icon language) ---------- */

const INK = '#37352f', GRN = '#4d9e68', GRNL = '#cfe8d6', YEL = '#f2ce74', CRM = '#faf6ec'
const artProps = (size) => ({ width: size, height: size, viewBox: '0 0 48 48', 'aria-hidden': true })

const Art = {
  sprout: ({ size = 24 }) => <svg {...artProps(size)}>
    <path d="M24 42 C24 34 24 29 24 23" stroke={INK} strokeWidth="2.8" strokeLinecap="round" fill="none" />
    <path d="M23 25 C14 25 9.5 19 9 11.5 C18 12 23 17 23.5 25 Z" fill={GRNL} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M24.5 21 C25 12.5 30 7.5 39 7 C38.5 15 33 20.5 24.5 21 Z" fill={GRN} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M15 42 h18" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
  </svg>,
  home: ({ size = 24 }) => <svg {...artProps(size)}>
    <rect x="10" y="21" width="28" height="21" rx="2" fill={CRM} stroke={INK} strokeWidth="2.6" />
    <path d="M5 23 L24 6 L43 23 Z" fill={GRNL} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
    <rect x="20" y="30" width="8" height="12" rx="3.5" fill={GRN} stroke={INK} strokeWidth="2.4" />
    <path d="M24 6 C24 3.5 26 2 28.5 2 C28.5 4.5 26.5 6 24 6 Z" fill={GRN} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
  </svg>,
  memo: ({ size = 24 }) => <svg {...artProps(size)}>
    <rect x="7" y="5" width="26" height="38" rx="3" fill="#fff" stroke={INK} strokeWidth="2.6" />
    <path d="M12 13 h16 M12 19 h16 M12 25 h9" stroke={GRNL} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M22 33 L34 21 L40 27 L28 39 Z" fill={YEL} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M34 21 L38 17 L44 23 L40 27 Z" fill={GRN} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M22 33 L28 39 L19 42 Z" fill={CRM} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
  </svg>,
  report: ({ size = 24 }) => <svg {...artProps(size)}>
    <path d="M7 42 H41" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
    <rect x="10" y="28" width="7.5" height="14" fill={GRNL} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <rect x="20.5" y="21" width="7.5" height="21" fill={YEL} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <rect x="31" y="13" width="7.5" height="29" fill={GRN} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M35 13 C35 7.5 38.5 5 43 5 C43 9.5 40 13 35 13 Z" fill={GRNL} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
  </svg>,
  doc: ({ size = 24 }) => <svg {...artProps(size)}>
    <path d="M11 7 H28 L37 16 V41 H11 Z" fill="#fff" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
    <path d="M28 7 V16 H37" fill={GRNL} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M16 24 h16 M16 30 h16 M16 36 h9" stroke={GRNL} strokeWidth="2.6" strokeLinecap="round" />
  </svg>,
  rocket: ({ size = 24 }) => <svg {...artProps(size)}>
    <path d="M24 4 C30 9 32 17 32 25 L24 33 L16 25 C16 17 18 9 24 4 Z" fill={CRM} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <circle cx="24" cy="17" r="4.2" fill={GRNL} stroke={INK} strokeWidth="2.2" />
    <path d="M16 25 L9 33 L17 32 Z" fill={GRN} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M32 25 L39 33 L31 32 Z" fill={GRN} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M24 34 C26.5 37.5 26.5 40.5 24 44 C21.5 40.5 21.5 37.5 24 34 Z" fill={YEL} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
  </svg>,
  folder: ({ size = 24 }) => <svg {...artProps(size)}>
    <path d="M6 13 a3 3 0 0 1 3 -3 h9 l4 4 h17 a3 3 0 0 1 3 3 v18 a3 3 0 0 1 -3 3 H9 a3 3 0 0 1 -3 -3 Z" fill={GRNL} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
    <path d="M24 33 C24 28.5 24 26.5 24 24.5 M23.3 26 C19 26 16.7 23 16.5 19 C21 19.2 23.2 22 23.3 26 Z M24.7 24 C25 19.8 27.5 17.3 32 17 C31.7 21.3 29 23.8 24.7 24 Z" fill={GRN} stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  keyboard: ({ size = 24 }) => <svg {...artProps(size)}>
    <rect x="5" y="13" width="38" height="22" rx="4" fill="#fff" stroke={INK} strokeWidth="2.6" />
    <path d="M11 20 h3 M18 20 h3 M25 20 h3 M32 20 h3 M11 26 h3 M18 26 h3 M25 26 h3 M32 26 h3" stroke={GRN} strokeWidth="2.8" strokeLinecap="round" />
    <path d="M16 31 h16" stroke={GRNL} strokeWidth="3" strokeLinecap="round" />
  </svg>,
  bulb: ({ size = 24 }) => <svg {...artProps(size)}>
    <path d="M24 4 a12.5 12.5 0 0 1 7.3 22.6 c-1.6 1.2 -2.3 2.5 -2.3 4.4 h-10 c0 -1.9 -.7 -3.2 -2.3 -4.4 A12.5 12.5 0 0 1 24 4 Z" fill={YEL} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M24 31 V22 M23.4 24 C20.2 24 18.5 21.8 18.4 18.8 C21.7 19 23.3 21 23.4 24 Z" fill={GRN} stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 35 h8 M20.5 39 h7" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
  </svg>,
  megaphone: ({ size = 24 }) => <svg {...artProps(size)}>
    <path d="M12 19 L30 10 V38 L12 29 Z" fill={GRNL} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <rect x="5" y="19" width="7" height="10" rx="2" fill={GRN} stroke={INK} strokeWidth="2.4" />
    <path d="M34 18 a8.5 8.5 0 0 1 0 12 M38.5 14 a15 15 0 0 1 0 20" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
  </svg>,
  smile: ({ size = 24 }) => <svg {...artProps(size)}>
    <circle cx="24" cy="24" r="17" fill={YEL} stroke={INK} strokeWidth="2.6" />
    <circle cx="18" cy="21" r="1.9" fill={INK} /><circle cx="30" cy="21" r="1.9" fill={INK} />
    <path d="M16.5 28 a8.5 6.5 0 0 0 15 0" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
  </svg>,
  picture: ({ size = 24 }) => <svg {...artProps(size)}>
    <rect x="6" y="9" width="36" height="30" rx="3" fill="#fff" stroke={INK} strokeWidth="2.6" />
    <circle cx="16.5" cy="18.5" r="4" fill={YEL} stroke={INK} strokeWidth="2.2" />
    <path d="M8.5 36 L19 25 L25 31 L32 23 L39.5 36 Z" fill={GRNL} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
  </svg>,
}

/* ---------- Block editor (Notion-style input) ---------- */

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

function BlockEditor({ blocks, onChange }) {
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
          <button className="grip" aria-label="移動">⠿</button>
        </div>
        {block.type === 'divider'
          ? <div className="b-divider"><hr /></div>
          : <div className={`b-wrap b-${block.type} ${block.type === 'todo' && block.checked ? 'done' : ''}`}>
              {block.type === 'bullet' && <span className="b-marker">•</span>}
              {block.type === 'number' && <span className="b-marker num">{numberCount}.</span>}
              {block.type === 'todo' && <button className={`b-check ${block.checked ? 'on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => patch(block.id, { checked: !block.checked })}>{block.checked && Icon.check}</button>}
              {block.type === 'callout' && <span className="b-callout-ico"><Art.bulb size={18} /></span>}
              <textarea
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
            <span className="slash-badge">{item.badge.startsWith('art:') ? Art[item.badge.slice(4)]({ size: 22 }) : item.badge}</span>
            <span><span className="slash-label">{item.label}</span><span className="slash-desc">{item.desc}</span></span>
          </button>)}
          {!menuItems.length && <p className="slash-empty">結果はありません</p>}
        </div>}
      </div>
    })}
  </div>
}

/* ---------- App ---------- */

function App() {
  const [active, setActive] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 720)
  const [editorId, setEditorId] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [starred, setStarred] = useState(false)
  const [notes, setNotes] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('nitoron:observations'))
      if (!stored) return makeInitialNotes()
      return stored.map((item) => ({
        ...item,
        id: isUuid(item.id) ? item.id : uid(),
        category: item.category ?? item.crop ?? '未分類',
        type: TYPE_COLORS[item.type] ? item.type : 'メモ',
        blocks: item.blocks?.length ? item.blocks : (item.body ? item.body.split('\n').map((line) => textBlock(line)) : [textBlock()]),
      }))
    } catch { return makeInitialNotes() }
  })
  const [cloud, setCloud] = useState(supabase ? 'loading' : 'off') // off | signedout | loading | online | error
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [showAuth, setShowAuth] = useState(false)

  const stateRef = useRef(null)
  stateRef.current = { notes, editorId, session }
  const syncTimers = useRef({})

  useEffect(() => localStorage.setItem('nitoron:observations', JSON.stringify(notes)), [notes])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => { setSession(s); if (s) setShowAuth(false) })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Cloud load on login: server wins when it has rows; otherwise seed it with local notes.
  const userId = session?.user?.id
  useEffect(() => {
    if (!supabase || !authReady) return
    if (!userId) { setCloud('signedout'); return }
    let cancelled = false
    setCloud('loading')
    const load = async () => {
      // ログイン機能導入前に作られた所有者なしの行を引き取る
      await supabase.from('notes').update({ user_id: userId }).is('user_id', null)
      const { data, error } = await supabase.from('notes').select('*').order('created_at', { ascending: false })
      if (cancelled) return
      if (error) { setCloud('error'); return }
      if (data.length) setNotes(data.map(noteFromRow))
      else if (stateRef.current.notes.length) supabase.from('notes').upsert(stateRef.current.notes.map(rowFromNote)).then(() => {})
      setCloud('online')
    }
    load()
    return () => { cancelled = true }
  }, [authReady, userId])

  const queuePush = (id) => {
    if (!supabase) return
    clearTimeout(syncTimers.current[id])
    syncTimers.current[id] = setTimeout(() => {
      const note = stateRef.current.notes.find((n) => n.id === id)
      if (note && stateRef.current.session) supabase.from('notes').upsert(rowFromNote(note)).then(({ error }) => { if (error) setCloud('error') })
    }, 800)
  }
  const patchNote = (id, p) => {
    setNotes((current) => current.map((n) => n.id === id ? { ...n, ...p, date: today() } : n))
    queuePush(id)
  }
  const removeNote = (id) => {
    clearTimeout(syncTimers.current[id])
    setNotes((current) => current.filter((n) => n.id !== id))
    if (supabase && stateRef.current.session) supabase.from('notes').delete().eq('id', id).then(({ error }) => { if (error) setCloud('error') })
  }
  const closeEditor = () => {
    const { notes: current, editorId: id } = stateRef.current
    const note = current.find((n) => n.id === id)
    if (note && !note.title.trim() && !noteText(note).trim() && note.category === '未分類') removeNote(note.id)
    setEditorId(null)
  }
  const openNew = () => {
    const note = { id: uid(), title: '', blocks: [textBlock()], category: '未分類', type: 'メモ', date: today() }
    setNotes((current) => [note, ...current])
    setEditorId(note.id)
  }
  const openNote = (id) => { setActive('notes'); setEditorId(id) }

  useEffect(() => {
    const keydown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setShowSearch(true) }
      if (event.key === 'Escape') { setShowSearch(false); if (stateRef.current.editorId) closeEditor() }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [])

  const page = PAGES.find((item) => item.id === active)
  const editorNote = notes.find((n) => n.id === editorId)
  const visible = useMemo(() => notes.filter((item) => `${item.title} ${noteText(item)} ${item.category} ${item.type}`.toLowerCase().includes(query.toLowerCase())), [notes, query])
  const navigate = (id) => { setActive(id); if (window.innerWidth <= 720) setSidebarOpen(false) }

  return <div className={`app ${sidebarOpen ? 'sidebar-visible' : ''}`}>
    <aside className="sidebar" aria-label="ワークスペース">
      <div className="switcher">
        <button className="switcher-name"><span className="ws-logo"><Art.sprout size={16} /></span><span className="ws-label">Nitoron</span>{Icon.chevronDown}</button>
        <button className="icon-btn collapse" onClick={() => setSidebarOpen(false)} aria-label="サイドバーを閉じる">{Icon.chevronsLeft}</button>
      </div>
      <div className="side-section">
        <button className="side-item" onClick={() => setShowSearch(true)}><span className="side-ico">{Icon.search}</span>検索<kbd>⌘K</kbd></button>
        <button className={`side-item ${active === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}><span className="side-ico">{Icon.home}</span>ホーム</button>
        <button className="side-item"><span className="side-ico">{Icon.inbox}</span>受信トレイ</button>
      </div>
      <div className="side-section">
        <p className="side-heading">プライベート</p>
        {PAGES.map((item) => <button key={item.id} className={`side-item page-item ${active === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}>
          <span className="side-ico art">{Art[item.art]({ size: 17 })}</span><span className="side-label">{item.label}</span>
          <span className="row-hover-actions"><span className="mini-btn">{Icon.dots}</span><span className="mini-btn">{Icon.plus}</span></span>
        </button>)}
        <button className="side-item muted" onClick={openNew}><span className="side-ico">{Icon.plus}</span>新規ページ</button>
      </div>
      <div className="side-section bottom">
        {supabase && authReady && (session
          ? <button className="side-item muted" onClick={() => supabase.auth.signOut()} title={session.user.email}><span className="side-ico">{Icon.user}</span><span className="account-mail">{session.user.email}</span><span className="account-action">ログアウト</span></button>
          : <button className="side-item muted" onClick={() => setShowAuth(true)}><span className="side-ico">{Icon.user}</span>ログイン</button>)}
        <button className="side-item muted"><span className="side-ico">{Icon.gear}</span>設定</button>
        <button className="side-item muted"><span className="side-ico">{Icon.trash}</span>ゴミ箱</button>
      </div>
    </aside>
    {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

    <main className="main">
      <header className="topbar">
        {!sidebarOpen && <button className="icon-btn" onClick={() => setSidebarOpen(true)} aria-label="サイドバーを開く">{Icon.menu}</button>}
        <button className="crumb"><span className="crumb-ico">{Art[page.art]({ size: 17 })}</span><span>{page.label}</span></button>
        <div className="topbar-right">
          <span className="edited">今日 編集</span>
          <button className="top-share">共有</button>
          <button className="icon-btn" aria-label="コメント">{Icon.comment}</button>
          <button className={`icon-btn ${starred ? 'starred' : ''}`} onClick={() => setStarred((s) => !s)} aria-label="お気に入り">{Icon.star}</button>
          <button className="icon-btn" aria-label="その他">{Icon.dots}</button>
        </div>
      </header>

      <div className="scroll-area">
        {active === 'home' ? <section className="home-canvas">
          <Home notes={notes} onNavigate={navigate} onCompose={openNew} onOpen={openNote} onSearch={() => setShowSearch(true)} />
        </section> : <>
          <div className="cover" style={{ background: page.cover }}><button className="cover-btn">カバー画像を変更</button></div>
          <section className="page-canvas">
            <div className="page-icon"><button>{Art[page.art]({ size: 62 })}</button></div>
            <div className="title-controls"><button><Art.smile size={15} /> アイコンを変更</button><button><Art.picture size={15} /> カバー画像を追加</button><button>{Icon.comment} コメントを追加</button></div>
            <h1 className="page-title">{page.title}</h1>
            {active === 'notes' && <Database items={notes} onCompose={openNew} onOpen={openNote} />}
            {active === 'report' && <Report items={notes} />}
          </section>
        </>}
      </div>
    </main>

    <nav className="mobile-nav">
      {PAGES.map((item) => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><span className="mobile-nav-ico">{Art[item.art]({ size: 20 })}</span>{item.label.slice(0, 4)}</button>)}
      <button onClick={() => setShowSearch(true)}><span className="mobile-nav-ico">{Icon.search}</span>検索</button>
      <button onClick={openNew}><span className="mobile-nav-ico plus">{Icon.plus}</span>新規</button>
    </nav>
    {editorNote && <NoteEditor note={editorNote} cloud={cloud} onPatch={(p) => patchNote(editorNote.id, p)} onClose={closeEditor} onDelete={() => { removeNote(editorNote.id); setEditorId(null) }} />}
    {showSearch && <Search query={query} setQuery={setQuery} items={visible} onClose={() => setShowSearch(false)} onPick={(item) => { setShowSearch(false); openNote(item.id) }} />}
    {showAuth && !session && <AuthModal onClose={() => setShowAuth(false)} />}
  </div>
}

/* ---------- Pages ---------- */

const LEARN_CARDS = [
  { id: 'l1', art: 'rocket', title: 'Nitoronをはじめよう', sub: '3分で読めます', cover: 'linear-gradient(135deg,#fdecc8,#f6e0b8)' },
  { id: 'l2', art: 'memo', title: 'メモの基本', sub: '5分で読めます', cover: 'linear-gradient(135deg,#dbeddb,#c9e2cd)' },
  { id: 'l3', art: 'folder', title: 'データベースで整理する', sub: '4分で読めます', cover: 'linear-gradient(135deg,#d3e5ef,#c2d8e8)' },
  { id: 'l4', art: 'keyboard', title: 'ショートカット一覧', sub: '2分で読めます', cover: 'linear-gradient(135deg,#e8deee,#dccfe6)' },
]

function SectionHead({ icon, label }) {
  return <div className="home-sec">
    <span className="home-sec-ico">{icon}</span><span>{label}</span><span className="home-sec-caret">{Icon.chevronDown}</span>
    <button className="icon-btn home-sec-more" aria-label="オプション">{Icon.dots}</button>
  </div>
}

function Home({ notes, onNavigate, onCompose, onOpen, onSearch }) {
  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'こんばんは' : hour < 11 ? 'おはようございます' : hour < 18 ? 'こんにちは' : 'こんばんは'
  const fmtDay = (offset) => {
    const d = new Date(); d.setDate(d.getDate() + offset)
    return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(d)
  }
  return <>
    <h1 className="home-hello">{greeting}、たきとさん</h1>
    <button className="ai-bar" onClick={onSearch}>
      <span className="ai-ico">{Icon.sparkle}</span>
      <span className="ai-placeholder">検索したり、質問したりしましょう…</span>
      <span className="ai-kbd"><kbd>⌘</kbd><kbd>K</kbd></span>
    </button>

    <SectionHead icon={Icon.clock} label="最近アクセスしたページ" />
    <div className="card-row">
      {PAGES.filter((p) => p.id !== 'home').map((p) => <button key={p.id} className="page-card" onClick={() => onNavigate(p.id)}>
        <div className="card-cover" style={{ background: p.cover }} /><span className="card-emoji">{Art[p.art]({ size: 24 })}</span>
        <p className="card-name">{p.label}</p><p className="card-sub"><span className="card-sub-ico">{Icon.clock}</span>今日</p>
      </button>)}
      {notes.slice(0, 2).map((item) => <button key={item.id} className="page-card" onClick={() => onOpen(item.id)}>
        <div className="card-cover plain" /><span className="card-emoji"><Art.doc size={24} /></span>
        <p className="card-name">{item.title || '無題'}</p><p className="card-sub"><span className="card-sub-ico">{Icon.clock}</span>{item.date.slice(5).replace('-', '/')}</p>
      </button>)}
      <button className="page-card new" onClick={onCompose}><span className="card-plus">{Icon.plus}</span><p className="card-name">新規ページ</p></button>
    </div>

    <SectionHead icon={Icon.calendar} label="今後の予定" />
    <div className="event-widget">
      <div className="event-day">
        <p className="event-date"><b>今日</b> {fmtDay(0)}</p>
        <div className="event blue"><p className="event-name">メモを見返す</p><p className="event-time">9:00 – 9:30</p></div>
        <div className="event green"><p className="event-name">レポートを書く</p><p className="event-time">16:00 – 17:00</p></div>
      </div>
      <div className="event-day">
        <p className="event-date"><b>明日</b> {fmtDay(1)}</p>
        <div className="event gray"><p className="event-name">週次のふりかえり</p><p className="event-time">終日</p></div>
      </div>
      <div className="event-day connect">
        <p className="event-date">カレンダー</p>
        <p className="connect-text">カレンダーを接続すると、ここに予定が表示されます。</p>
        <button className="connect-btn">カレンダーを接続</button>
      </div>
    </div>

    <SectionHead icon={Icon.checkbox} label="マイタスク" />
    <div className="home-widget">
      <div className="widget-tabs"><button className="widget-tab active">{Icon.table}<span>メモ</span></button><button className="widget-tab">{Icon.plus}</button></div>
      <div className="widget-rows">
        {notes.slice(0, 4).map((item) => <button key={item.id} className="widget-row" onClick={() => onOpen(item.id)}>
          <span className="link-ico">{Icon.page}</span>
          <span className="widget-row-title">{item.title || '無題'}</span>
          <span className={`tag ${TYPE_COLORS[item.type] || 'tag-gray'}`}>{item.type}</span>
          <span className="widget-row-date">{item.date}</span>
        </button>)}
        <button className="widget-row new" onClick={onCompose}><span className="link-ico">{Icon.plus}</span><span className="widget-row-title muted">新規</span></button>
      </div>
      <button className="widget-foot" onClick={() => onNavigate('notes')}>すべて表示</button>
    </div>

    <SectionHead icon={Icon.book} label="学ぶ" />
    <div className="learn-row">
      {LEARN_CARDS.map((card) => <button key={card.id} className="learn-card">
        <div className="learn-cover" style={{ background: card.cover }}>{Art[card.art]({ size: 42 })}</div>
        <p className="learn-title">{card.title}</p>
        <p className="learn-sub">{card.sub}</p>
      </button>)}
    </div>
  </>
}

function Database({ items, onCompose, onOpen }) {
  return <div className="db">
    <div className="db-toolbar">
      <div className="db-views"><button className="db-view active">{Icon.table}<span>テーブルビュー</span></button><button className="db-view muted">{Icon.plus}</button></div>
      <div className="db-actions"><button>フィルター</button><button>並べ替え</button><button className="icon-btn">{Icon.search}</button><button className="icon-btn">{Icon.dots}</button><button className="db-new" onClick={onCompose}>新規<span className="db-new-caret">{Icon.chevronDown}</span></button></div>
    </div>
    <div className="db-scroll">
      <table className="db-table">
        <thead><tr>
          <th><span>{Icon.text}名前</span></th>
          <th><span>{Icon.tag}タグ</span></th>
          <th><span>{Icon.tag}カテゴリ</span></th>
          <th><span>{Icon.calendar}日付</span></th>
          <th className="th-plus"><span>{Icon.plus}</span></th>
        </tr></thead>
        <tbody>
          {items.map((item) => <tr key={item.id} onClick={() => onOpen(item.id)}>
            <td className="cell-name"><span className="cell-ico">{Icon.page}</span><span className="cell-title">{item.title || '無題'}</span><span className="open-hint">開く</span></td>
            <td><span className={`tag ${TYPE_COLORS[item.type] || 'tag-gray'}`}>{item.type}</span></td>
            <td><span className="tag tag-brown">{item.category}</span></td>
            <td className="cell-date">{item.date}</td>
            <td />
          </tr>)}
          <tr className="row-new" onClick={onCompose}><td colSpan="5"><span>{Icon.plus}</span>新規</td></tr>
        </tbody>
        <tfoot><tr><td colSpan="5">カウント <b>{items.length}</b></td></tr></tfoot>
      </table>
    </div>
  </div>
}

function Report({ items }) {
  const chosen = items.slice(0, 5)
  return <>
    <div className="block callout gray"><span className="callout-ico"><Art.megaphone size={20} /></span><p>レポートの下書きです。メモが増えるほど、内容を組み立てやすくなります。</p></div>
    <h2 className="block-h2">要点のまとめ</h2>
    <p className="block-p">以下のメモをもとに、内容を組み立てます。</p>
    {chosen.map((item, index) => <div className="numbered" key={item.id}>
      <span className="num">{index + 1}.</span>
      <div><p className="num-title">{item.title || '無題'}</p><p className="num-body">{noteText(item) || '内容を追加してください。'}</p></div>
    </div>)}
    <blockquote className="block-quote">日々の記録が、次の判断をつくる。</blockquote>
    <div className="add-block"><span>{Icon.plus}</span>クリックして下に追加</div>
  </>
}

const CLOUD_LABELS = { off: '自動保存(この端末のみ)', signedout: 'この端末に保存・ログインで同期', loading: '同期中…', online: 'クラウドに自動保存', error: '同期エラー・ローカル保存' }

function NoteEditor({ note, cloud, onPatch, onClose, onDelete }) {
  const bodyRef = useRef(null)
  return <div className="overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className="peek">
      <div className="peek-bar">
        <span className="peek-hint">メモ</span>
        <div className="peek-bar-right">
          <span className="autosave">{CLOUD_LABELS[cloud] || '自動保存'}</span>
          <button className="icon-btn" onClick={onDelete} aria-label="削除">{Icon.trash}</button>
          <button className="icon-btn" aria-label="その他">{Icon.dots}</button>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
      </div>
      <div className="peek-body" ref={bodyRef}>
        <input
          className="peek-title" autoFocus={!note.title}
          value={note.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); bodyRef.current?.querySelector('.blocks textarea')?.focus() } }}
          placeholder="無題"
        />
        <div className="peek-props">
          <div className="prop"><span className="prop-label">{Icon.tag}タグ</span>
            <select value={note.type} onChange={(e) => onPatch({ type: e.target.value })}><option>メモ</option><option>アイデア</option><option>タスク</option></select></div>
          <div className="prop"><span className="prop-label">{Icon.tag}カテゴリ</span>
            <input value={note.category === '未分類' ? '' : note.category} onChange={(e) => onPatch({ category: e.target.value || '未分類' })} placeholder="空" /></div>
          <div className="prop"><span className="prop-label">{Icon.calendar}日付</span><span className="prop-value">{note.date}</span></div>
        </div>
        <BlockEditor blocks={note.blocks} onChange={(blocks) => onPatch({ blocks })} />
      </div>
    </div>
  </div>
}

function AuthModal({ onClose }) {
  const [mode, setMode] = useState('signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState(null) // { kind: 'error' | 'info', text }
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setNotice(null)
    const { data, error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (error) { setNotice({ kind: 'error', text: error.message }); return }
    if (!data.session) { setNotice({ kind: 'info', text: '確認メールを送信しました。メール内のリンクを開いてから、ここでログインしてください。' }); setMode('signin'); return }
    onClose()
  }

  return <div className="overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <form className="auth-modal" onSubmit={submit}>
      <span className="auth-logo"><Art.sprout size={36} /></span>
      <h2 className="auth-title">{mode === 'signin' ? 'Nitoronにログイン' : 'アカウントを作成'}</h2>
      <p className="auth-sub">メモをクラウドに同期して、どの端末からも開けるようにします。</p>
      <label className="auth-label">メールアドレス
        <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
      </label>
      <label className="auth-label">パスワード
        <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6文字以上" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
      </label>
      {notice && <p className={`auth-notice ${notice.kind}`}>{notice.text}</p>}
      <button className="auth-submit" type="submit" disabled={busy}>{busy ? '送信中…' : mode === 'signin' ? 'ログイン' : '登録する'}</button>
      <button className="auth-switch" type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setNotice(null) }}>
        {mode === 'signin' ? 'アカウントがない場合は新規登録' : 'すでにアカウントがある場合はログイン'}
      </button>
    </form>
  </div>
}

function Search({ query, setQuery, items, onClose, onPick }) {
  return <div className="overlay search-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className="search-modal">
      <div className="search-input-row"><span className="search-ico">{Icon.search}</span><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nitoronを検索…" /><kbd>Esc</kbd></div>
      <div className="search-results">
        <p className="search-section">{query ? '検索結果' : '最近のページ'}</p>
        {items.map((item) => <button key={item.id} onClick={() => onPick(item)}>
          <span className="link-ico">{Icon.page}</span>
          <span className="sr-main"><strong>{item.title || '無題'}</strong><span>メモ 内</span></span>
          <span className="sr-date">{item.date}</span>
        </button>)}
        {!items.length && <p className="no-hit">一致する結果はありません。</p>}
      </div>
      <div className="search-foot"><span><kbd>↑↓</kbd> 移動</span><span><kbd>⏎</kbd> 開く</span></div>
    </div>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
