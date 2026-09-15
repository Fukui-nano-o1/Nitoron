import React, { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { AccountAuth } from './Account.jsx'
import { watchPrivateAccess } from './private-access.mjs'
import './private-access.css'

export default function PrivateAccess({ children }) {
  const [access, setAccess] = useState({ status: 'checking', session: null })
  useEffect(() => watchPrivateAccess(supabase?.auth, setAccess), [])
  const open = access.status === 'allowed'
  return <>
    {access.session && <div className="private-app" hidden={!open} inert={!open}>{children(access.session)}</div>}
    {!open && <main className="private-login" aria-labelledby="private-login-title">
    <div className="private-login-card">
      <span className="private-login-brand">nitoron</span>
      <h1 id="private-login-title">ログイン</h1>
      {access.status === 'checking' ? <p role="status">ログインを確認しています…</p>
        : access.status === 'unavailable' ? <p role="alert">ログインを利用できません。時間をおいて再読み込みしてください。</p>
          : <AccountAuth session={null} />}
    </div>
    </main>}
  </>
}
