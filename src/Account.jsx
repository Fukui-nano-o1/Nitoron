import React, { useState } from 'react'
import { supabase } from './supabase.js'
import { Dialog, Field, ErrorNotice } from './ui.jsx'

export default function Account({ session, name, onName, flush, onClose }) {
  const [email, setEmail] = useState(''), [mode, setMode] = useState('register')
  const [token, setToken] = useState(''), [sent, setSent] = useState(false), [sentType, setSentType] = useState('email')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const permanent = session?.user && !session.user.is_anonymous && session.user.email_confirmed_at
  const run = async action => { setBusy(true); setError(''); try { await action() } catch (e) { setError(e.message || '操作を完了できませんでした。') } finally { setBusy(false) } }
  const send = e => { e.preventDefault(); run(async () => {
    if (!supabase) throw new Error('クラウドの設定が見つかりません。再読み込みしてからお試しください。')
    if (session && !await flush()) throw new Error('記録の保存を完了してからアカウントを設定してください。')
    // 仮アカウントがある間はメール追加で記録を引き継ぐ。無い場合もOTPで直接登録・ログインできる。
    const upgrade = mode === 'register' && !!session
    const result = upgrade
      ? await supabase.auth.updateUser({ email }, { emailRedirectTo: location.origin + location.pathname })
      : await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: mode === 'register', emailRedirectTo: location.origin + location.pathname } })
    if (result.error) throw new Error(mode === 'register' ? 'メールを送れませんでした。登録済みの場合は「ログイン」を選んでください。' : 'メールを送れませんでした。入力と登録状態を確認してください。')
    setSentType(upgrade ? 'email_change' : 'email')
    setSent(true); setNotice('メールの確認リンクを開くか、記載された確認コードを入力してください。')
  }) }
  const verify = e => { e.preventDefault(); run(async () => {
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: sentType })
    if (verifyError) throw new Error('コードを確認してください。有効期限が切れた場合は送り直してください。')
    setNotice('メールアドレスを確認しました。'); setSent(false)
  }) }
  return <Dialog title="アカウントと保存" onClose={busy ? () => {} : onClose}>
    <Field label="表示名"><input maxLength={80} value={name} onChange={e => onName(e.target.value)} placeholder="発表や指摘に使う名前" /></Field>
    {permanent ? <>
      <div className="account-state"><strong>{session.user.email}</strong><p>このメールアドレスで別の端末からも記録を開けます。</p></div>
      <button className="secondary" disabled={busy} onClick={() => run(async () => {
        if (!await flush()) throw new Error('保存が完了していません。再試行してからログアウトしてください。')
        const { error: signoutError } = await supabase.auth.signOut({ scope: 'local' })
        if (signoutError) throw new Error('ログアウトできませんでした。')
        location.reload()
      })}>ログアウト</button>
    </> : <>
      <p>{session ? '現在はこの端末の仮アカウントです。メールを登録すると、記録を引き継いで公開・指摘を行えます。' : 'メールを登録すると、クラウドに保存して公開・指摘を行えます。端末だけに保存した記録は、ログイン後に「自分の記録」の「端末だけの記録を復元」で取り込めます。'}</p>
      <div className="segmented" aria-label="アカウントの操作">
        <button aria-pressed={mode === 'register'} disabled={busy} onClick={() => { setMode('register'); setSent(false) }}>この記録で登録</button>
        <button aria-pressed={mode === 'login'} disabled={busy} onClick={() => { setMode('login'); setSent(false) }}>ログイン</button>
      </div>
      {mode === 'login' && <p className="notice">ログイン先には、この仮アカウントの記録は移りません。必要な記録は先に「書き出す」で保管してください。</p>}
      {!sent ? <form onSubmit={send}>
        <Field label="メールアドレス"><input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <button className="primary" disabled={busy}>{busy ? '送信中…' : '確認メールを送る'}</button>
      </form> : <form onSubmit={verify}>
        <Field label="メールの確認コード"><input autoComplete="one-time-code" inputMode="numeric" required pattern="[0-9]{6,8}" maxLength={8} value={token} onChange={e => setToken(e.target.value)} /></Field>
        <div className="actions"><button className="primary" disabled={busy}>確認する</button><button type="button" className="quiet" disabled={busy} onClick={() => { setSent(false); setNotice('') }}>メールを送り直す</button></div>
      </form>}
    </>}
    {notice && <p className="notice" role="status">{notice}</p>}{error && <ErrorNotice>{error}</ErrorNotice>}
  </Dialog>
}
