import React, { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { RecordCard } from './Catalog.jsx'
import { getUserPublic, getProfile } from './community.js'
import { ErrorNotice } from './ui.jsx'

export default function User({ id, savedIds, onSave, selectedKeys, keyOf, onSelect }) {
  const [records, setRecords] = useState(null), [profile, setProfile] = useState(null), [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    setRecords(null); setProfile(null); setError('')
    getUserPublic(id).then(data => { if (!cancelled) setRecords(data) }).catch(e => { if (!cancelled) setError(e.message) })
    getProfile(id).then(p => { if (!cancelled) setProfile(p) }).catch(() => { /* 発表だけでもページは成立する。 */ })
    return () => { cancelled = true }
  }, [id])
  const meta = records?.[0]?.meta
  const name = profile?.display_name || meta?.author || '発表者'
  const region = profile?.region || meta?.region, club = profile?.club || meta?.club
  const facts = records?.reduce((n, r) => n + (r.meta?.observations?.filter(o => o.fact.trim()).length || 0), 0) || 0
  const since = records?.length ? records.map(r => r.publication.publishedAt).sort()[0]?.slice(0, 4) : ''
  return <section className="user-page">
    <div className="listing-back print-hidden"><a href="#/discover"><Icon name="left" size={16} />発表を探す</a></div>
    {error ? <ErrorNotice>{error}</ErrorNotice> : !records ? <p className="loading" role="status">プロフィールを読み込み中…</p> : <div className="user-columns">
      <aside className="user-aside">
        <div className="host-card">
          <div className="host-identity"><span className="avatar-circle xl" aria-hidden="true">{name.slice(0, 1)}</span><strong>{name}</strong><span>発表者</span></div>
          <dl className="host-stats">
            <div><dd>{records.length}</dd><dt>発表</dt></div>
            <div><dd>{facts}</dd><dt>観測した事実</dt></div>
            {since && <div><dd>{since}年〜</dd><dt>発表歴</dt></div>}
          </dl>
        </div>
        {(region || club) && <div className="host-facts">
          {region && <div><Icon name="pin" size={20} />{region}で実践</div>}
          {club && <div><Icon name="flag" size={20} />{club}</div>}
        </div>}
      </aside>
      <div className="user-main">
        <h1>{name}さんについて</h1>
        {profile?.bio && <div className="user-about"><p>{profile.bio}</p></div>}
        <h2>{name}さんの発表</h2>
        {records.length ? <div className="record-grid">{records.map(r => <RecordCard key={r.id} record={r} href={`#/public/${r.id}`} publicMode selected={selectedKeys.includes(keyOf(r))} onSelect={onSelect} saved={savedIds.includes(r.id)} onSave={onSave} />)}</div>
          : <p className="hint">公開中の発表はまだありません。</p>}
      </div>
    </div>}
  </section>
}
