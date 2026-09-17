import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import RecordBody from './RecordBody.jsx'
import PhotoGallery from './PhotoGallery.jsx'
import RecordMemo from './RecordMemo.jsx'
import Icon from './Icon.jsx'
import { isRepairRecord } from './repair-workspace.mjs'
const RepairDetail = React.lazy(() => import('./RepairWorkspace.jsx').then(module => ({ default: module.RepairDetail })))
import { Dialog } from './ui.jsx'
import { KINDS, METRICS, number } from './domain.js'
import { imageAttachments, sanitizeAttachments } from './attachment-domain.js'
import { listPublic } from './community.js'
import { RecordCard } from './Catalog.jsx'
import { EMPTY_FILTERS, discoverHref } from './search.js'
import { sectionsOf, relatedRows, isCatalogRecord, catalogNav } from './catalog-domain.js'
// ページ内の飛び先。ハッシュルーティングと衝突しないよう、リンク先は書き換えずにスクロールだけする。
const jump = id => e => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) }
// 節ナビ（Airbnb の listing で写真の下に出る「写真・アメニティ・レビュー・地図」の行）。上部に固定され、本文の h2 が3つ以上あるときに出す。
// カタログ解説では記録内検索もこの固定バーに置く（PC は右端に入力欄、スマホは虫めがねを押すと入力行が開く）。本文の途中に置くと探さないと見つからない。
function SectionNav({ record, hasDiscussion, hasRelated, search = null }) {
  const catalog = isCatalogRecord(record)
  const sections = useMemo(() => catalog ? catalogNav(record.blocks) : sectionsOf(record.blocks), [catalog, record.blocks])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('')
  const inputRef = useRef(null), navRef = useRef(null), tabsRef = useRef(null)
  const items = useMemo(() => [...sections, ...(hasDiscussion ? [{ id: 'discussion', title: '対話' }] : []), ...(hasRelated ? [{ id: 'related', title: '関連' }] : [])], [sections, hasDiscussion, hasRelated])
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const offset = (navRef.current?.getBoundingClientRect().bottom || 0) + 28
      const available = items.map(item => ({ ...item, element: document.getElementById(item.id) })).filter(item => item.element)
      let current = available[0]?.id || ''
      for (const item of available) {
        if (item.element.getBoundingClientRect().top <= offset) current = item.id
        else break
      }
      setActive(current)
    }
    const queue = () => { if (!frame) frame = requestAnimationFrame(update) }
    queue()
    window.addEventListener('scroll', queue, { passive: true })
    window.addEventListener('resize', queue)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', queue); window.removeEventListener('resize', queue) }
  }, [items, search?.query])
  useEffect(() => {
    const track = tabsRef.current, selected = track?.querySelector('[aria-current="location"]')
    if (!selected) return
    const child = selected.getBoundingClientRect(), parent = track.getBoundingClientRect()
    if (child.left < parent.left || child.right > parent.right) track.scrollBy({ left: child.left - parent.left - 12, behavior: 'instant' })
  }, [active])
  if (sections.length < 3 && !search) return null
  const expanded = !!search && (open || !!search.query)
  const toggle = () => { if (expanded) { search.onQuery(''); setOpen(false) } else { setOpen(true); setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50) } }
  return <nav ref={navRef} className={`section-nav print-hidden${expanded ? ' search-open' : ''}`} aria-label="この記録の節">
    <div ref={tabsRef} className="section-nav-tabs">{items.map(s => <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? 'location' : undefined} onClick={jump(s.id)}>{s.title.replace(/（.*?）/g, '')}</a>)}</div>
    {search && <>
      <button type="button" className="nav-search-toggle" aria-expanded={expanded} aria-label={expanded ? '記録内検索を閉じる' : 'この記録の中を探す'} onClick={toggle}><Icon name={expanded ? 'close' : 'search'} size={18} /></button>
      <form className="nav-search" role="search" onSubmit={e => { e.preventDefault(); inputRef.current?.blur() }}><Icon name="search" size={16} /><input ref={inputRef} type="search" maxLength={160} value={search.query} onChange={e => search.onQuery(e.target.value)} placeholder="この記録の中を探す（部品名・症状・数値）" aria-label="この記録の中を探す" />{search.query && <button type="button" className="quiet" onClick={() => { search.onQuery(''); inputRef.current?.focus({ preventScroll: true }) }}>クリア</button>}</form>
    </>}
  </nav>
}
// 最下部の関連カード行（Airbnb の「他の宿泊先」）。同じシリーズ→同じメーカーの順に横1段ずつ。0件の行は出さない。
function RelatedRow({ row, excludeId }) {
  const [records, setRecords] = useState(null)
  const track = useRef(null)
  const trackId = useId()
  const [edges, setEdges] = useState({ start: true, end: true })
  const state = { query: row.query, region: '', filters: { ...EMPTY_FILTERS, kind: 'trouble' }, sort: 'recent', page: 0 }
  useEffect(() => {
    let cancelled = false
    setRecords(null)
    listPublic({ ...state, limit: 12 }).then(data => { if (!cancelled) setRecords(data.records.filter(r => r.id !== excludeId)) }).catch(() => { if (!cancelled) setRecords([]) })
    return () => { cancelled = true }
  }, [row.query, excludeId])
  useEffect(() => {
    const el = track.current
    if (!el) return
    const update = () => setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 })
    el.scrollLeft = 0
    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => { el.removeEventListener('scroll', update); observer.disconnect() }
  }, [records])
  const move = direction => {
    const el = track.current
    if (!el) return
    const first = el.firstElementChild
    const stride = (first?.getBoundingClientRect().width || el.clientWidth) + (parseFloat(getComputedStyle(el).columnGap) || 0)
    const left = direction * stride * Math.max(1, Math.floor(el.clientWidth / stride))
    el.scrollBy({ left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  const onKeyDown = event => {
    if (event.target !== event.currentTarget || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    if (event.key === 'Home' || event.key === 'End') track.current.scrollTo({ left: event.key === 'Home' ? 0 : track.current.scrollWidth, behavior: 'instant' })
    else move(event.key === 'ArrowLeft' ? -1 : 1)
  }
  if (!records?.length) return null
  return <section className="listing-row" aria-label={row.label}>
    <div className="listing-row-head"><h2>{row.label}</h2><div className="listing-row-actions"><a href={discoverHref(state)}>すべて見る</a>
      {!(edges.start && edges.end) && <div className="listing-row-arrows print-hidden">
        <button type="button" aria-label={`${row.label}を前へ`} aria-controls={trackId} disabled={edges.start} onClick={() => move(-1)}><Icon name="left" size={16} /></button>
        <button type="button" aria-label={`${row.label}を次へ`} aria-controls={trackId} disabled={edges.end} onClick={() => move(1)}><Icon name="right" size={16} /></button>
      </div>}
    </div></div>
    <div ref={track} id={trackId} className="listing-row-scroll" tabIndex={0} role="group" aria-label={row.label} onKeyDown={onKeyDown}>{records.map(r => <RecordCard key={r.id} record={r} href={`#/public/${r.id}`} publicMode />)}</div>
  </section>
}
// 記録の公開ページ。Airbnb の listing と同じ並び：戻る → 見出し → 写真 → 記録者 → 要点 → 本文。右カード（PCの右／スマホの下部固定バー）の主操作は「質問・指摘を送る」。
// 「この実践を試す」など派生記録の入口は置かない。記録の種類（経営発表・カタログ・修理）で見出しの語を変え、発表だけを前提にしない。
// preview: 確認画面での「公開したときの見え方」。表示だけで、保存・フォロー・対話などのデータ更新は一切起きない。
// editHref: 所有者にだけ渡す「編集する」の遷移先。
export default function PublicRecord({ record, focusSection = '', onBack, selected, onSelect, saved, onSave, onShare, session, canFollow, following, onFollow, onAccount, notify, discussion, preview = false, editHref = null }) {
  const [moreOpen, setMoreOpen] = useState(false)
  // カタログ解説の記録内検索。欄は上部の固定バー（SectionNav）に、結果は本文（RecordBody）に。語が変わったら結果の先頭が固定バーの下に来るよう送る。
  const [bodyQuery, setBodyQuery] = useState('')
  useEffect(() => { setBodyQuery(''); setMoreOpen(false) }, [record.id])
  const bodySearch = isCatalogRecord(record) ? { query: bodyQuery, onQuery: setBodyQuery } : null
  useEffect(() => { if (!bodyQuery.trim()) return; const el = document.getElementById('record-search-results'), bar = document.querySelector('.section-nav'); if (el && el.getBoundingClientRect().top < (bar?.getBoundingClientRect().bottom || 0)) el.scrollIntoView({ block: 'start' }) }, [bodyQuery])
  // 「#/public/:id?sec=sec-xxx」で来たら（取扱説明書の頁ページの小見出しから）、その節を開いた状態で先頭に据え、短く光らせて焦点を示す。
  useEffect(() => {
    if (!focusSection) return
    let tries = 20, timer = null
    const attempt = () => {
      const el = document.getElementById(focusSection)
      if (!el) { if (--tries > 0) timer = setTimeout(attempt, 100); return }
      el.scrollIntoView({ block: 'start' })
      el.classList.add('is-focused'); timer = setTimeout(() => el.classList.remove('is-focused'), 1800)
    }
    timer = setTimeout(attempt, 60)
    return () => clearTimeout(timer)
  }, [focusSection, record.id])
  if (isRepairRecord(record)) return <RepairDetail key={record.id} record={record} readOnly onBack={onBack} onShare={preview ? undefined : onShare} onBookmark={preview ? undefined : onSave} bookmarked={saved} editHref={editHref} discussion={discussion} additionalMenu={preview ? null : <>{onSelect && <button aria-pressed={selected} onClick={onSelect}>{selected ? '比較から外す' : 'ほかの記録と比較'}</button>}{canFollow && <button aria-pressed={following} onClick={onFollow}>{following ? '記録者をフォロー中' : '記録者をフォロー'}</button>}<RecordMemo record={record} session={session} onAccount={onAccount} notify={notify} /></>} />
  const m = record.meta, count = m?.observations.filter(o => o.fact.trim()).length || 0
  const photos = imageAttachments(record).length, files = sanitizeAttachments(m?.attachments).length - photos
  const hasNumbers = METRICS.some(([key]) => number(m?.[key]) !== null)
  const sources = m?.sources?.filter(s => s.title || s.url).length || 0
  const author = m?.author || '記録者', kind = KINDS[m?.kind || 'memo'], catalog = m?.kind === 'trouble'
  const subtitle = [m?.region, m?.crop, m?.variety].filter(Boolean).join(' · ')
  // 要点3つ：種類ごとに意味のある数だけ。経営発表＝作物・観測・記録日、カタログ＝分類・出典・記録日。
  const facts = catalog
    ? [[m?.crop || record.category || '分類未記録', '分類'], [`${sources}件`, '出典・資料'], [record.date, '記録日']]
    : [[[m?.crop, m?.variety].filter(Boolean).join(' ') || '作物未記録', '作物'], [`${count}件`, '観測した事実'], [record.date, '記録日']]
  const back = onBack ? <button onClick={onBack} aria-label="一覧へ戻る"><Icon name="left" size={16} /><span>一覧へ戻る</span></button> : <a href="#/discover" aria-label="記録を探す"><Icon name="left" size={16} /><span>記録を探す</span></a>
  const editLink = editHref && <a className="text-action owner-edit" href={editHref}><Icon name="pencil" size={16} />編集する</a>
  const toDiscussion = jump('discussion')
  // 「その他」メニューからログイン案内へ進むときは、メニューを閉じてから開く（モーダルを重ねない）。
  const accountFromMore = () => { setMoreOpen(false); onAccount() }
  const highlights = <div className="listing-highlights">
    {count > 0 && <div><Icon name="check" size={24} /><div><strong>観測した事実が{count}件</strong><small>日付・条件・根拠つきで記録された事実です。</small></div></div>}
    {hasNumbers && <div><Icon name="compare" size={24} /><div><strong>経営の数字を記録</strong><small>売上・経費などを、ほかの記録と並べて比べられます。</small></div></div>}
    {sources > 0 && <div><Icon name="file" size={24} /><div><strong>出典・資料が{sources}件</strong><small>数値には元の資料の頁が添えられています。</small></div></div>}
    {(photos > 0 || files > 0) && <div><Icon name="upload" size={24} /><div><strong>{[photos > 0 && `写真${photos}枚`, files > 0 && `資料${files}点`].filter(Boolean).join('・')}を掲載</strong><small>現場の写真と裏づけ資料をそのまま確認できます。</small></div></div>}
    <div><Icon name="chat" size={24} /><div><strong>記録者と対話できる</strong><small>気になる条件や結果は、{preview ? '質問・指摘' : <a href="#discussion" onClick={toDiscussion}>質問・指摘</a>}で直接確かめられます。</small></div></div>
  </div>
  const authorSection = <div className="author-section"><div><h2>{author}{catalog ? '' : 'さん'}の{kind}</h2><p>{[m?.club, m?.region].filter(Boolean).join(' · ') || '記録者の所属・地域は未記録'}</p>{!preview && canFollow && <button className="text-action follow-button print-hidden" aria-pressed={following} onClick={onFollow}><Icon name="user-plus" size={16} />{following ? 'フォロー中' : 'フォローする'}</button>}</div>
    {preview ? <span className="avatar-circle large" aria-hidden="true">{author.slice(0, 1)}</span> : <a className="avatar-circle large" href={`#/user/${record.publication.owner}`} aria-label={`${author}のプロフィールを表示`}>{author.slice(0, 1)}</a>}</div>
  const factsRow = <div className="record-facts">{facts.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
  const related = preview ? [] : relatedRows(record)
  const sectionNav = <SectionNav record={record} hasDiscussion={!preview && !!discussion} hasRelated={related.length > 0} search={bodySearch} />
  if (preview) return <article className="listing-page preview" aria-label="公開プレビュー">
    <header className="listing-title"><span className="listing-kind">{kind}</span><h1>{record.title}</h1><div className="listing-subtitle"><span>{subtitle}</span><span className="preview-tag">{kind}</span></div></header>
    <div className="listing-hero"><PhotoGallery record={record} /></div>
    {sectionNav}
    <div className="listing-columns"><div className="listing-main">{authorSection}{factsRow}{highlights}<RecordBody record={record} hideHeading hideCover search={bodySearch} focusSection={focusSection} /></div></div>
    <div className="publication-date">公開版の更新：{String(record.publication?.updatedAt || '').slice(0, 10) || '未公開'}</div>
  </article>
  return <article className="listing-page">
    <div className="listing-back print-hidden">{back}<span>{editLink}{kind}</span></div>
    <header className="listing-title"><span className="listing-kind">{kind}</span><h1>{record.title}</h1><div className="listing-subtitle"><span>{subtitle}</span><div className="actions print-hidden"><button className="text-action" onClick={onShare}><Icon name="share" size={18} />共有</button><button className="text-action" aria-pressed={saved} onClick={onSave}><Icon name="heart" size={18} fill={saved ? 'currentColor' : 'none'} />{saved ? '保存済み' : '保存'}</button><button className="text-action" aria-haspopup="dialog" onClick={() => setMoreOpen(true)}><Icon name="menu" size={18} />その他</button></div></div></header>
    <div className="listing-hero"><PhotoGallery record={record} />
      <div className="hero-overlay print-hidden">{back}<div><button onClick={onShare} aria-label="共有"><Icon name="share" size={18} /></button><button aria-pressed={saved} onClick={onSave} aria-label={saved ? '保存リストから外す' : '保存リストに追加'}><Icon name="heart" size={18} fill={saved ? '#ff385c' : 'none'} color={saved ? '#ff385c' : undefined} /></button><button aria-haspopup="dialog" aria-label="その他の操作" onClick={() => setMoreOpen(true)}><Icon name="menu" size={18} /></button>{editHref && <a href={editHref} aria-label="編集する"><Icon name="pencil" size={18} /></a>}</div></div>
    </div>
    {sectionNav}
    <div className="listing-columns"><div className="listing-main">{authorSection}{factsRow}{highlights}<RecordBody record={record} hideHeading hideCover search={bodySearch} focusSection={focusSection} /></div>
    <aside className="listing-aside print-hidden"><div className="action-card"><h2>この記録について</h2>
      <dl className="action-facts"><div><dt>種類</dt><dd>{kind}</dd></div><div><dt>記録日</dt><dd>{record.date}</dd></div><div><dt>記録者</dt><dd>{author}</dd></div></dl>
      <a className="primary" href="#discussion" onClick={toDiscussion}>質問・指摘を送る</a>
      <div className="action-list">
        <button className="action-row" aria-pressed={saved} onClick={onSave}><span className="action-icon"><Icon name="heart" size={20} fill={saved ? 'currentColor' : 'none'} /></span><span><strong>{saved ? '保存済み' : '保存する'}</strong><small>保存リストから、あとで開けます。</small></span></button>
        <button className="action-row" onClick={onShare}><span className="action-icon"><Icon name="share" size={20} /></span><span><strong>共有する</strong><small>リンクは誰でも読めます。</small></span></button>
        <button className="action-row" aria-haspopup="dialog" onClick={() => setMoreOpen(true)}><span className="action-icon"><Icon name="menu" size={20} /></span><span><strong>その他</strong><small>ほかの記録との比較、自分だけのメモ。</small></span></button>
        {editHref && <a className="action-row" href={editHref}><span className="action-icon"><Icon name="pencil" size={20} /></span><span><strong>編集する</strong><small>自分の記録です。下書きを編集して公開版を更新できます。</small></span></a>}
      </div></div><button className="text-action print-button" onClick={() => window.print()}>印刷・PDFに保存</button></aside></div>
    {discussion}
    {related.length > 0 && <div className="listing-rows" id="related">{related.map(row => <RelatedRow key={row.key} row={row} excludeId={record.id} />)}</div>}
    <div className="publication-date">公開版の更新：{record.publication.updatedAt.slice(0, 10)}</div>
    {moreOpen && <Dialog title="その他の操作" onClose={() => setMoreOpen(false)}><div className="action-list more-menu">
      <button className="action-row" aria-pressed={selected} onClick={onSelect}><span className="action-icon"><Icon name={selected ? 'check' : 'compare'} size={20} /></span><span><strong>{selected ? '比較から外す' : 'ほかの記録と比較する'}</strong><small>{selected ? '比較に選択中です。' : '3件まで選んで、条件と数字を並べられます。'}</small></span></button>
      <RecordMemo record={record} session={session} onAccount={accountFromMore} notify={notify} />
    </div></Dialog>}
    <div className="listing-mobile-action print-hidden"><div><strong>{kind} · {record.date}</strong><button className="text-action" aria-pressed={saved} onClick={onSave}>{saved ? '保存済み' : '保存する'}</button></div><a className="primary" href="#discussion" onClick={toDiscussion}>質問・指摘を送る</a></div>
  </article>
}
