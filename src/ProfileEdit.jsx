import React, { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { getProfile, saveProfile } from './community.js'
import { Field, ErrorNotice } from './ui.jsx'

export default function ProfileEdit({ session, name, onName, onAccount }) {
  const [form, setForm] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!session) return
    let cancelled = false
    getProfile(session.user.id)
      .then(p => { if (!cancelled) setForm({ display_name: p?.display_name || name || '', region: p?.region || '', club: p?.club || '', bio: p?.bio || '' }) })
      .catch(() => { if (!cancelled) setForm({ display_name: name || '', region: '', club: '', bio: '' }) })
    return () => { cancelled = true }
  }, [session?.user.id])
  const set = (key, value) => { setForm(f => ({ ...f, [key]: value })); setSaved(false) }
  const submit = e => {
    e.preventDefault(); setBusy(true); setError('')
    saveProfile(session, form).then(() => { onName(form.display_name.trim()); setSaved(true) }).catch(err => setError(err.message)).finally(() => setBusy(false))
  }
  if (!session) return <section className="edit-page">
    <h1>プロフィールを編集</h1>
    <div className="saved-empty"><h2>ログインするとプロフィールを編集できます</h2><p>名前・地域・自己紹介は、あなたの発表を読む人への信頼になります。</p><button className="primary" onClick={onAccount}>登録・ログイン</button></div>
  </section>
  return <section className="edit-page">
    <div className="listing-back print-hidden"><a href="#/account"><Icon name="left" size={16} />アカウント</a></div>
    <div className="edit-columns">
      <aside className="edit-aside">
        <span className="avatar-circle xl" aria-hidden="true">{(form?.display_name || name)?.slice(0, 1) || <Icon name="user" size={40} />}</span>
        <strong>{form?.display_name || name || '名前未登録'}</strong>
        <a className="text-action" href={`#/user/${session.user.id}`}>プロフィールを表示</a>
      </aside>
      <div className="edit-main">
        <h1>プロフィールを編集</h1>
        <p className="hint">ここに書いた内容は、あなたの発表を読む人に公開されます。連絡先や住所は書かないでください。</p>
        {!form ? <p className="loading" role="status">読み込み中…</p> : <form onSubmit={submit}>
          <Field label="表示名" help="発表や指摘に使う名前"><input maxLength={80} required value={form.display_name} onChange={e => set('display_name', e.target.value)} /></Field>
          <div className="fields two">
            <Field label="活動している地域" help="例：福井県"><input maxLength={80} value={form.region} onChange={e => set('region', e.target.value)} /></Field>
            <Field label="所属クラブ" help="例：福井4Hクラブ"><input maxLength={120} value={form.club} onChange={e => set('club', e.target.value)} /></Field>
          </div>
          <Field label="自己紹介" help={`つくっている作物、経営の目標、いま検証していること（${form.bio.length}/600）`}><textarea rows={6} maxLength={600} value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="例：ブロッコリー30aの2期作に挑戦中。数字で語れる経営を目指しています。" /></Field>
          {error && <ErrorNotice>{error}</ErrorNotice>}
          <div className="edit-actions">{saved && <span className="hint" role="status">保存しました</span>}<button className="primary" disabled={busy}>{busy ? '保存中…' : '完了'}</button></div>
        </form>}
      </div>
    </div>
  </section>
}
