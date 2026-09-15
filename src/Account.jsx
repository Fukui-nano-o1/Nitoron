import React, { useState } from 'react'
import { supabase } from './supabase.js'
import { Dialog, Field, ErrorNotice } from './ui.jsx'
import { isPrivateUser, sendPrivateLogin, verifyPrivateLogin } from './private-access.mjs'

// The private login gate and the signed-in account page share this form.
export function AccountAuth({ session, flush }) {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState(''), [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const permanent = isPrivateUser(session?.user)
  const run = async action => { setBusy(true); setError(''); try { await action() } catch (e) { setError(e.message || '操作を完了できませんでした。') } finally { setBusy(false) } }
  const send = e => { e.preventDefault(); run(async () => {
    await sendPrivateLogin(supabase?.auth, email, location.origin + location.pathname + location.hash)
    setToken(''); setSent(true); setNotice('メールの確認コードを入力してください。')
  }) }
  const verify = e => { e.preventDefault(); run(async () => {
    await verifyPrivateLogin(supabase?.auth, email, token)
    setNotice('ログインを確認しています…')
  }) }
  return <>
    {permanent ? <>
      <div className="account-state"><strong>{session.user.email}</strong><p>このメールアドレスで別の端末からも記録を開けます。</p></div>
      <button className="secondary" disabled={busy} onClick={() => run(async () => {
        if (!await flush()) throw new Error('保存が完了していません。再試行してからログアウトしてください。')
        const { error: signoutError } = await supabase.auth.signOut({ scope: 'local' })
        if (signoutError) throw new Error('ログアウトできませんでした。')
        location.reload()
      })}>ログアウト</button>
    </> : <>
      {!sent ? <form onSubmit={send}>
        <Field label="メールアドレス"><input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <button className="primary" disabled={busy}>{busy ? '送信中…' : 'ログインメールを送る'}</button>
      </form> : <form onSubmit={verify}>
        <Field label="メールの確認コード"><input autoComplete="one-time-code" inputMode="numeric" required pattern="[0-9]{6,8}" maxLength={8} value={token} onChange={e => setToken(e.target.value)} /></Field>
        <div className="actions"><button className="primary" disabled={busy}>確認する</button><button type="button" className="quiet" disabled={busy} onClick={() => { setSent(false); setToken(''); setNotice(''); setError('') }}>メールを送り直す</button></div>
      </form>}
    </>}
    {notice && <p className="notice" role="status">{notice}</p>}{error && <ErrorNotice>{error}</ErrorNotice>}
  </>
}
export default function Account({ session, flush, onClose }) {
  return <Dialog title="アカウントと保存" onClose={onClose}><AccountAuth session={session} flush={flush} /><p className="hint"><a href="#/account" onClick={onClose}>アカウントページで、個人情報・機械・公開設定も入力できます。</a></p></Dialog>
}
