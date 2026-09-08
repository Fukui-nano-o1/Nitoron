import React, { useState } from 'react'
import { Empty } from './ui.jsx'
import { METRICS, number, per10a, formatNumber } from './domain.js'
export default function Compare({ records, onRemove }) {
  const [basis, setBasis] = useState('total')
  if (!records.length) return <Empty title="同じ問いで、記録を見比べる" action={<a className="primary" href="#/mine">記録を選ぶ</a>}>一覧で「比較に追加」を選ぶと、最大3件を並べて読めます。</Empty>
  const context = [['作物', 'crop'], ['品種', 'variety'], ['地域', 'region'], ['対象面積（a）', 'areaA'], ['対象期間の開始', 'start'], ['対象期間の終了', 'end'], ['比較の条件', 'conditions']]
  const values = records.map(r => r.meta || {})
  const crops = new Set(values.map(m => m.crop).filter(Boolean))
  return <section className="catalog"><div className="page-heading"><div><div className="eyebrow">COMPARE</div><h1>条件から比較する</h1></div>
    <div className="segmented"><button aria-pressed={basis === 'total'} onClick={() => setBasis('total')}>記録の合計</button><button aria-pressed={basis === '10a'} onClick={() => setBasis('10a')}>10aあたり</button></div></div>
    <p className="notice">{crops.size > 1 ? '作物が異なる記録が含まれます。' : ''}数字の差だけでは原因を判断できません。期間・栽培条件・経費の範囲も確認してください。</p>
    <div className="comparison-scroll"><table className="comparison"><caption className="sr-only">選択した記録の条件、経営の数字、仮説と結果の比較</caption>
      <thead><tr><th scope="col">{records.length}件を比較</th>{records.map(r => <th scope="col" key={r.id + !!r.publication}><a href={`#/${r.publication ? 'public' : 'record'}/${r.id}`}>{r.title || '無題'}</a><span>{r.meta?.author || '発表者未記録'}</span><button className="quiet" onClick={() => onRemove(r)}>比較から外す</button></th>)}</tr></thead>
      <tbody>{context.map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{values.map((m, i) => <td key={i}>{m[key] || '未記録'}</td>)}</tr>)}
        <tr className="table-divider"><th colSpan={records.length + 1}>経営の数字 {basis === '10a' ? '／10aあたり' : '／記録の合計'}</th></tr>
        {METRICS.map(([key, label, unit]) => <tr className="number-row" key={key}><th scope="row">{label}（{unit}）</th>{values.map((m, i) => <td key={i}>{formatNumber(basis === '10a' ? per10a(m[key], m.areaA) : number(m[key]))}</td>)}</tr>)}
        <tr className="number-row"><th scope="row">収支差額（円）<small>売上 − 記録した経費</small></th>{values.map((m, i) => {
          const revenue = number(m.revenue), cost = number(m.cost), area = number(m.areaA)
          const delta = revenue !== null && cost !== null ? revenue - cost : null
          const amount = basis === 'total' ? delta : delta !== null && area > 0 ? delta * 10 / area : null
          return <td key={i}>{formatNumber(amount)}</td>
        })}</tr>
        <tr className="table-divider"><th colSpan={records.length + 1}>考え方と確かめたこと</th></tr>
        {[['課題', 'issue'], ['仮説', 'hypothesis'], ['実践', 'action'], ['結果', 'result'], ['考察', 'interpretation'], ['学び・次の一手', 'learning']].map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{values.map((m, i) => <td key={i}>{m[key] || '未記録'}</td>)}</tr>)}
      </tbody></table></div><p className="hint">面積が未記録なら10a換算は表示しません。空欄は0として扱いません。</p>
  </section>
}
