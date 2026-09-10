import React, { useState } from 'react'
import { Empty } from './ui.jsx'
import Cover from './Cover.jsx'
import Icon from './Icon.jsx'
import { METRICS } from './domain.js'
import { imageAttachments, sanitizeAttachments } from './attachment-domain.js'
import { metricCell, per10aCell, balanceCell, canConvert, conditionText, BLANK } from './compare-domain.js'
const CONTEXT = [['作物', m => m.crop], ['品種', m => m.variety], ['地域', m => m.region], ['対象面積', m => m.areaA ? `${m.areaA} a` : ''], ['対象期間', m => m.start || m.end ? `${m.start || '？'} 〜 ${m.end || '？'}` : ''], ['比較の条件', m => m.conditions]]
const STORY = [['課題', 'issue'], ['仮説', 'hypothesis'], ['実践', 'action'], ['結果', 'result'], ['考察', 'interpretation'], ['学び・次の一手', 'learning']]
const Value = ({ children }) => children ? children : <span className="unrecorded">{BLANK}</span>
const Cell = ({ cell }) => cell.kind === 'number' ? cell.text : <span className={cell.kind === 'text' ? 'as-written' : 'unrecorded'}>{cell.text}</span>
// 比較表：基本条件 → 経営の数字（列ごとの対象条件つき） → 根拠 → 考え方。単位は元データのまま、未入力は「未記載」。
export default function Compare({ records, onRemove, onBack }) {
  const [basis, setBasis] = useState('total')
  if (!records.length) return <Empty title="同じ問いで、記録を見比べる" action={<><a className="primary" href="#/saved">保存リストから選ぶ</a> <a className="secondary" href="#/mine">自分の実践から選ぶ</a></>}>保存リストの「比較する」や、発表詳細の「その他」から2〜3件を選ぶと、並べて読めます。</Empty>
  const values = records.map(r => r.meta || {})
  const crops = new Set(values.map(m => m.crop).filter(Boolean))
  const convertible = canConvert(values)
  const mode = basis === '10a' && convertible ? '10a' : 'total'
  return <section className="catalog compare-page">
    <div className="compare-top print-hidden"><button className="text-action" onClick={onBack}><Icon name="left" size={14} />戻る</button></div>
    <div className="page-heading"><div><h1>{records.length}件を並べて比較</h1><p>数字の差だけでは原因を判断できません。対象条件・栽培条件・経費の範囲もあわせて確認してください。</p></div>
      <div className="segmented" role="group" aria-label="数字の基準"><button aria-pressed={mode === 'total'} onClick={() => setBasis('total')}>記録の合計</button><button aria-pressed={mode === '10a'} disabled={!convertible} title={convertible ? '' : '面積が記載された数値がないため換算できません'} onClick={() => setBasis('10a')}>10aあたり</button></div></div>
    {crops.size > 1 && <p className="notice">作物が異なる記録が含まれます。数字を直接比べる前に、条件の違いを確認してください。</p>}
    {records.length < 2 && <p className="notice">もう1件選ぶと、並べて比べられます。</p>}
    <div className="comparison-scroll"><table className="comparison"><caption className="sr-only">選択した記録の条件、経営の数字、根拠、仮説と結果の比較</caption>
      <thead><tr><th scope="col"><span className="compare-count">{records.length}件を比較</span></th>{records.map(r => {
        const href = `#/${r.publication ? 'public' : 'record'}/${r.id}`
        return <th scope="col" key={r.id + !!r.publication}><div className="compare-card">
          <div className="compare-visual"><a href={href} tabIndex={-1} aria-hidden="true"><Cover record={r} /></a>
            <button className="compare-remove" aria-label={`${r.title || '無題'}を比較から外す`} onClick={() => onRemove(r)}><Icon name="close" size={13} /></button></div>
          <a className="compare-copy" href={href}><strong>{r.title || '無題'}</strong><span>{r.meta?.author || '発表者未記載'}{r.publication ? '' : ' · 自分の記録'}</span></a>
        </div></th>
      })}</tr></thead>
      <tbody>
        <tr className="table-divider"><th colSpan={records.length + 1}><span className="divider-label">基本条件</span></th></tr>
        {CONTEXT.map(([label, pick]) => <tr key={label}><th scope="row">{label}</th>{values.map((m, i) => <td key={i}><Value>{pick(m)}</Value></td>)}</tr>)}
        <tr className="table-divider"><th colSpan={records.length + 1}><span className="divider-label">経営の数字<small>{mode === '10a' ? '10aあたりに換算（面積が記載された列だけ）' : '記録の合計。単位は元データのまま'}</small></span></th></tr>
        <tr className="condition-row"><th scope="row">対象条件</th>{values.map((m, i) => <td key={i}>{conditionText(m)}</td>)}</tr>
        {METRICS.map(([key, label, unit]) => <tr className="number-row" key={key}><th scope="row">{label}<small>{unit}</small></th>{values.map((m, i) => <td key={i}><Cell cell={mode === '10a' ? per10aCell(m[key], m.areaA, unit) : metricCell(m[key], unit)} /></td>)}</tr>)}
        <tr className="number-row"><th scope="row">収支差額<small>円 · 計算値（売上 − 記録した経費）</small></th>{values.map((m, i) => <td key={i}><Cell cell={balanceCell(m.revenue, m.cost, m.areaA, mode)} /></td>)}</tr>
        <tr className="table-divider"><th colSpan={records.length + 1}><span className="divider-label">根拠</span></th></tr>
        <tr><th scope="row">観測した事実</th>{records.map((r, i) => { const facts = (r.meta?.observations || []).filter(o => o.fact.trim()); return <td key={i}>{facts.length ? <><strong>{facts.length}件</strong><br />{facts[0].date && `${facts[0].date}：`}{facts[0].fact.slice(0, 80)}{facts[0].fact.length > 80 ? '…' : ''}</> : <span className="unrecorded">{BLANK}</span>}</td> })}</tr>
        <tr><th scope="row">写真・資料</th>{records.map((r, i) => { const photos = imageAttachments(r).length, files = sanitizeAttachments(r.meta?.attachments).length - photos; return <td key={i}><Value>{[photos > 0 && `写真${photos}枚`, files > 0 && `資料${files}点`].filter(Boolean).join('・')}</Value></td> })}</tr>
        <tr><th scope="row">本人の判定<small>挑戦のみ</small></th>{values.map((m, i) => <td key={i}>{m.kind === 'challenge' ? <Value>{m.verdict}</Value> : <span className="unrecorded">—</span>}</td>)}</tr>
        <tr><th scope="row">公開版の更新</th>{records.map((r, i) => <td key={i}>{r.publication?.updatedAt ? r.publication.updatedAt.slice(0, 10) : <span className="unrecorded">自分の記録（未公開または下書き）</span>}</td>)}</tr>
        <tr className="table-divider"><th colSpan={records.length + 1}><span className="divider-label">考え方と確かめたこと</span></th></tr>
        {STORY.map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{values.map((m, i) => <td key={i}><Value>{m[key]}</Value></td>)}</tr>)}
      </tbody></table></div><p className="hint">未入力は「未記載」、入力された0は0として表示します。10a換算と収支差額は計算値で、面積や売上・経費が未記載の列では算出しません。</p>
  </section>
}
