import React, { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { ErrorNotice } from './ui.jsx'
import { supabase } from './supabase.js'
import { getProfile, saveProfile, getPrivateProfile, savePrivateProfile } from './community.js'
import { ROLES, PUBLIC_FIELDS, PRIVATE_FIELDS, emptyMachine, sanitizePublicProfile, sanitizePrivateProfile, hasMachine, machineLabel, missingPublic, missingPrivate } from './account-domain.js'
import { AccountAuth } from './Account.jsx'

// アカウント：入口（カード一覧）と各項目のページ。Airbnb の Account／Personal info と同じ構成：
// 見出し → 「名前, メール · プロフィールを表示」 → カード → 自分のページ4行（修理記録はヘッダーのピルとタブにあるので置かない） → 各ページは「行ごとに 編集／保存」と右側の説明パネル。
export const ACCOUNT_SECTIONS = [
  ['personal', '個人情報', 'user', '名前・立場・地域・連絡先。公開と非公開を分けて入力'],
  ['login', 'ログインとセキュリティ', 'shield', 'メールでログイン、ログアウト'],
  ['machines', '持っている機械', 'wrench', 'メーカー・型式・年式。修理記録の入力に使う'],
  ['sharing', '公開と共有', 'globe', '公開中の記録と、他の人に見える情報'],
  ['data', '記録のデータ', 'database', '書き出し・取り込み・端末だけの記録'],
]
const sectionOf = key => ACCOUNT_SECTIONS.find(([k]) => k === key)
const isPermanent = session => !!session?.user && !session.user.is_anonymous && !!session.user.email_confirmed_at

function Crumbs({ title }) {
  return <nav className="account-crumbs" aria-label="現在地"><a href="#/account">アカウント</a><Icon name="right" size={12} /><span>{title}</span></nav>
}
function LoginPrompt({ text }) {
  return <div className="account-panel account-login-prompt"><Icon name="shield" size={28} /><div><strong>ログインすると入力できます</strong><p>{text}</p></div><a className="primary" href="#/account/login">ログイン</a></div>
}

// 1行＝1項目。押すと同じ行の中で編集し、保存で閉じる（Airbnb の Personal info と同じ）。
function InfoRow({ label, value, help, priv = false, editing, onEdit, onCancel, onSave, busy, children, link }) {
  return <div className={`info-row${editing ? ' editing' : ''}`}>
    <div className="info-row-head"><div><span className="info-label">{label}{priv && <small className="info-private">非公開</small>}</span>{!editing && <span className="info-value">{value || '未入力'}</span>}</div>
      {link ? <a className="text-action" href={link}>編集</a> : <button className="text-action" onClick={editing ? onCancel : onEdit}>{editing ? 'キャンセル' : value ? '編集' : '追加'}</button>}</div>
    {editing && <div className="info-edit">{help && <p className="hint">{help}</p>}{children}<button className="primary dark" disabled={busy} onClick={onSave}>{busy ? '保存中…' : '保存'}</button></div>}
  </div>
}

function useProfiles(session) {
  const [pub, setPub] = useState(null), [priv, setPriv] = useState(null), [error, setError] = useState('')
  useEffect(() => {
    if (!session) { setPub(null); setPriv(null); return }
    let cancelled = false
    getProfile(session.user.id).then(p => { if (!cancelled) setPub(sanitizePublicProfile(p)) }).catch(e => { if (!cancelled) { setPub(sanitizePublicProfile(null)); setError(e.message) } })
    getPrivateProfile(session).then(p => { if (!cancelled) setPriv(sanitizePrivateProfile(p)) }).catch(e => { if (!cancelled) { setPriv(sanitizePrivateProfile(null)); setError(e.message) } })
    return () => { cancelled = true }
  }, [session?.user.id])
  return { pub, setPub, priv, setPriv, error, setError }
}

function Personal({ session, name, onName }) {
  const { pub, setPub, priv, setPriv, error, setError } = useProfiles(session)
  const [editing, setEditing] = useState(''), [draft, setDraft] = useState(''), [busy, setBusy] = useState(false)
  if (!session) return <LoginPrompt text="名前・立場・地域は公開ページに、氏名・電話番号・住所は本人だけが読める項目として保存します。" />
  if (!pub || !priv) return <p className="loading" role="status">読み込み中…</p>
  const start = (key, value) => { setEditing(key); setDraft(value); setError('') }
  const save = async (key, isPrivate) => {
    setBusy(true); setError('')
    try {
      if (isPrivate) { const next = { ...priv, [key]: draft }; await savePrivateProfile(session, next); setPriv(sanitizePrivateProfile(next)) }
      else { const next = { ...pub, [key]: draft }; await saveProfile(session, next); setPub(sanitizePublicProfile(next)); if (key === 'display_name') onName(draft.trim()) }
      setEditing('')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const input = (key, limit, rows = 0) => key === 'role' ? <select value={draft} onChange={e => setDraft(e.target.value)}><option value="">選ばない</option>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
    : rows ? <textarea rows={rows} maxLength={limit} value={draft} onChange={e => setDraft(e.target.value)} /> : <input maxLength={limit} type={key === 'phone' ? 'tel' : 'text'} autoComplete={key === 'phone' ? 'tel' : key === 'full_name' ? 'name' : key === 'address' ? 'street-address' : 'off'} value={draft} onChange={e => setDraft(e.target.value)} />
  return <div className="account-columns"><div className="account-main">
    <div className="info-group"><h2>公開される情報</h2>
      {PUBLIC_FIELDS.map(([key, label, help, limit]) => <InfoRow key={key} label={label} value={pub[key] || (key === 'display_name' ? name : '')} help={help} editing={editing === key} onEdit={() => start(key, pub[key] || (key === 'display_name' ? name : ''))} onCancel={() => setEditing('')} onSave={() => save(key, false)} busy={busy}>{input(key, limit, key === 'bio' ? 5 : 0)}</InfoRow>)}
    </div>
    <div className="info-group"><h2>本人だけが読める情報</h2>
      <InfoRow label="メールアドレス" value={isPermanent(session) ? session.user.email : ''} priv link="#/account/login" />
      {PRIVATE_FIELDS.map(([key, label, help, limit]) => <InfoRow key={key} label={label} value={priv[key]} help={help} priv editing={editing === key} onEdit={() => start(key, priv[key])} onCancel={() => setEditing('')} onSave={() => save(key, true)} busy={busy}>{input(key, limit, key === 'address' ? 2 : 0)}</InfoRow>)}
    </div>
    {error && <ErrorNotice>{error}</ErrorNotice>}
  </div><aside className="account-aside">
    <div className="account-panel"><Icon name="globe" size={28} /><h3>他の人に見える情報</h3><p>表示名・立場・地域・所属・主な作物・自己紹介は、あなたのプロフィールと公開した記録に表示されます。</p></div>
    <div className="account-panel"><Icon name="shield" size={28} /><h3>本人だけが読める情報</h3><p>氏名・電話番号・住所は公開ページにも記録にも出ません。修理の依頼・見積り・連絡のときだけ使います。</p></div>
    <div className="account-panel"><Icon name="check" size={28} /><h3>入力の状態</h3><p>{missingPublic(pub).length ? `公開情報の未入力：${missingPublic(pub).join('・')}` : '公開情報はすべて入力済みです。'}<br />{missingPrivate(priv).length ? `非公開情報の未入力：${missingPrivate(priv).join('・')}` : '非公開情報はすべて入力済みです。'}</p></div>
  </aside></div>
}

function Machines({ session }) {
  const { pub, setPub, error, setError } = useProfiles(session)
  const [rows, setRows] = useState(null), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false)
  useEffect(() => { if (pub && rows === null) setRows(pub.machines.length ? pub.machines : [emptyMachine()]) }, [pub])
  if (!session) return <LoginPrompt text="メーカー・型式・年式を登録しておくと、修理記録の機械の欄をここから選べます。" />
  if (!pub || !rows) return <p className="loading" role="status">読み込み中…</p>
  const set = (id, key, value) => { setRows(r => r.map(m => m.id === id ? { ...m, [key]: value } : m)); setSaved(false) }
  const save = async () => {
    setBusy(true); setError('')
    try { const next = { ...pub, machines: rows.filter(hasMachine) }; await saveProfile(session, next); setPub(sanitizePublicProfile(next)); setSaved(true) } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <div className="account-columns"><div className="account-main">
    <p className="hint">持っている機械を登録します。この一覧はプロフィールに表示されます。号機番号や購入店は書かないでください。</p>
    <div className="machine-rows">{rows.map((m, i) => <div className="machine-row" key={m.id}>
      <div className="machine-row-head"><strong>{machineLabel(m)}</strong><button className="text-action" onClick={() => { setRows(r => r.filter(x => x.id !== m.id)); setSaved(false) }}>削除</button></div>
      <div className="fields two"><label className="field"><span>メーカー</span><input maxLength={60} value={m.maker} placeholder="例：クボタ" onChange={e => set(m.id, 'maker', e.target.value)} /></label><label className="field"><span>型式</span><input maxLength={80} value={m.model} placeholder="例：SKP-101W" onChange={e => set(m.id, 'model', e.target.value)} /></label></div>
      <div className="fields two"><label className="field"><span>年式・購入年</span><input maxLength={12} value={m.year} placeholder="例：2019" onChange={e => set(m.id, 'year', e.target.value)} /></label><label className="field"><span>メモ</span><input maxLength={200} value={m.note} placeholder="例：中古で購入、稼働350h" onChange={e => set(m.id, 'note', e.target.value)} /></label></div>
    </div>)}</div>
    <div className="actions"><button className="secondary" disabled={rows.length >= 30} onClick={() => setRows(r => [...r, emptyMachine()])}><Icon name="plus" size={16} />機械を追加</button><button className="primary dark" disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button>{saved && <span className="hint" role="status">保存しました</span>}</div>
    {error && <ErrorNotice>{error}</ErrorNotice>}
  </div><aside className="account-aside">
    <div className="account-panel"><Icon name="wrench" size={28} /><h3>何に使うか</h3><p>修理記録を書くとき、機械の欄に手入力せずに選べるようになります。修理業者・販売店に相談するときの一覧にもなります。</p></div>
    <div className="account-panel"><Icon name="globe" size={28} /><h3>公開範囲</h3><p>メーカー・型式・年式・メモはプロフィールで公開されます。</p></div>
  </aside></div>
}

function Sharing({ session, owned }) {
  const { pub } = useProfiles(session)
  const published = owned.filter(p => p.is_public).length
  const shown = pub ? PUBLIC_FIELDS.filter(([key]) => pub[key].trim()).map(([, label]) => label) : []
  return <div className="account-columns"><div className="account-main">
    <div className="info-group"><h2>公開している記録</h2>
      <div className="info-row"><div className="info-row-head"><div><span className="info-label">公開中の記録</span><span className="info-value">{session ? `${published}件` : 'ログインすると確認できます'}</span></div><a className="text-action" href="#/mine">一覧</a></div></div>
      {session && <div className="info-row"><div className="info-row-head"><div><span className="info-label">公開プロフィール</span><span className="info-value">{shown.length ? shown.join('・') : '公開している項目はありません'}{pub?.machines?.length ? `・機械${pub.machines.length}台` : ''}</span></div><a className="text-action" href={`#/user/${session.user.id}`}>表示</a></div></div>}
    </div>
    <div className="info-group"><h2>公開されない情報</h2><p className="hint">氏名・電話番号・住所・メールアドレス・下書きの記録・保存リストは、他の人には表示されません。</p></div>
  </div><aside className="account-aside">
    <div className="account-panel"><Icon name="globe" size={28} /><h3>公開の単位</h3><p>記録は1件ずつ本人が公開します。公開を止めると、リンクから読めなくなります。</p></div>
  </aside></div>
}

function Data({ data }) {
  const fileRef = useRef(null)
  return <div className="account-columns"><div className="account-main">
    <div className="info-group"><h2>バックアップ</h2>
      <div className="info-row"><div className="info-row-head"><div><span className="info-label">全記録を書き出す</span><span className="info-value">発表・修理記録をJSONで保存（写真・添付は含まれません）</span></div><button className="text-action" disabled={!data.ready} onClick={data.exportAll}>書き出す</button></div></div>
      <div className="info-row"><div className="info-row-head"><div><span className="info-label">バックアップを取り込む</span><span className="info-value">書き出したJSONを新しい記録として追加（既存の記録は残ります）</span></div><button className="text-action" disabled={!data.ready} onClick={() => fileRef.current.click()}>選ぶ</button><input hidden type="file" ref={fileRef} accept="application/json,.json" onChange={data.importBackup} /></div></div>
    </div>
    <div className="info-group"><h2>この端末</h2>
      <div className="info-row"><div className="info-row-head"><div><span className="info-label">端末だけの記録</span><span className="info-value">{data.deviceRecords.length ? `${data.deviceRecords.length}件（ログイン前にこの端末で書いた記録）` : 'ありません'}</span></div>{!!data.deviceRecords.length && <button className="text-action" onClick={data.restoreDevice}>取り込む</button>}</div></div>
    </div>
  </div><aside className="account-aside">
    <div className="account-panel"><Icon name="database" size={28} /><h3>保存のしくみ</h3><p>記録は端末に保存され、ログインしているとクラウドにも同期します。書き出しは手元に控えを残すためのものです。</p></div>
  </aside></div>
}

function Hub({ session, name, onLogout, activityMine, activitySaved, selectedCount }) {
  const permanent = isPermanent(session)
  return <>
    <header className="account-head"><h1>アカウント</h1>
      <p className="account-identity"><strong>{name || '名前未登録'}</strong>{permanent && <>, {session.user.email}</>}{!permanent && <>, {session ? 'この端末の仮アカウント' : '未ログイン'}</>}{session && <> · <a href={`#/user/${session.user.id}`}>プロフィールを表示</a></>}</p></header>
    {!permanent && <div className="account-notice"><div><strong>メールを登録すると、別の端末からも記録を開けます</strong><p>{session ? 'この端末の記録はそのまま引き継がれます。' : '登録すると、クラウドに保存して公開・指摘ができます。'}</p></div><a className="primary dark" href="#/account/login">ログイン</a></div>}
    <div className="account-grid">{ACCOUNT_SECTIONS.map(([key, title, icon, desc]) => <a className="account-card" key={key} href={`#/account/${key}`}><Icon name={icon} size={30} /><strong>{title}</strong><span>{desc}</span></a>)}</div>
    <h2 className="account-sub">自分のページ</h2>
    <nav className="profile-menu" aria-label="自分のページ">
      {[['mine', '自分の実践', 'book', activityMine ? `新着の指摘 ${activityMine}件` : '経営発表を書く・公開する', activityMine],
        ['saved', '保存リスト', 'heart', activitySaved ? `新着の指摘 ${activitySaved}件` : 'ハートを付けた記録', activitySaved],
        ['talks', '対話', 'chat', '質問・指摘と返信', 0],
        ['compare', '比較', 'compare', selectedCount ? `${selectedCount}件を選択中` : '記録を並べて比べる', 0]]
        .map(([id, label, icon, desc, alert]) => <a key={id} href={`#/${id}`}><Icon name={icon} size={24} /><span><strong>{label}</strong><small className={alert ? 'menu-new' : undefined}>{desc}</small></span>{!!alert && <i className="notify-dot static" aria-hidden="true" />}<Icon name="right" size={16} /></a>)}
    </nav>
    {permanent && <button className="text-action account-logout" onClick={onLogout}>ログアウト</button>}
  </>
}

export default function AccountPage({ section, session, name, onName, flush, owned, activityMine, activitySaved, selectedCount, data, notify }) {
  const current = sectionOf(section)
  const logout = async () => {
    try {
      if (!await flush()) throw new Error('保存が完了していません。再試行してからログアウトしてください。')
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw new Error('ログアウトできませんでした。')
      location.reload()
    } catch (e) { notify(e.message) }
  }
  if (!current) return <section className="account-page">
    <Hub session={session} name={name} onLogout={logout} activityMine={activityMine} activitySaved={activitySaved} selectedCount={selectedCount} />
  </section>
  const [key, title] = current
  return <section className="account-page">
    <Crumbs title={title} />
    <h1 className="account-title">{title}</h1>
    {key === 'personal' && <Personal session={session} name={name} onName={onName} />}
    {key === 'login' && <div className="account-columns"><div className="account-main account-auth"><AccountAuth session={session} flush={flush} /></div><aside className="account-aside"><div className="account-panel"><Icon name="shield" size={28} /><h3>パスワードはありません</h3><p>メールに届く確認リンクか確認コードでログインします。</p></div></aside></div>}
    {key === 'machines' && <Machines session={session} />}
    {key === 'sharing' && <Sharing session={session} owned={owned} />}
    {key === 'data' && <Data data={data} />}
  </section>
}
