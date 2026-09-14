// data/catalog/**/*.json → public/catalog/ の静的ページ。原文・図は含めず、値と頁参照だけを描く。
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
const root = new URL('../', import.meta.url).pathname, src = join(root, 'data/catalog'), out = join(root, 'public/catalog')
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const pageRef = (entry, printed) => {
  if (printed == null) return ''
  const m = entry.sources.manual
  const physical = typeof printed === 'string' && printed.startsWith('安-') ? Number(printed.slice(2)) + 6 : Number(printed) + 18
  const label = typeof printed === 'string' ? printed : `印刷p.${printed}`
  return `<a class="ref" href="${esc(m.noticeUrl)}" target="_blank" rel="noopener noreferrer" title="取扱説明書 ${esc(m.partNumber)} PDF ${physical}ページ">${esc(label)}<span>PDF ${physical}</span></a>`
}
const css = `*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f7f7f5;color:#222}main{max-width:900px;margin:auto;padding:20px 16px 80px}a{color:#0b5d8a}h1{font-size:1.5rem;margin:8px 0 4px}h2{font-size:1.1rem;margin:28px 0 8px;border-bottom:2px solid #222;padding-bottom:6px}.kicker{font-size:.8rem;color:#666}.rule{font-size:.8rem;color:#555;background:#fff;border:1px solid #ddd;border-radius:10px;padding:10px 12px;margin:12px 0}dl{display:grid;grid-template-columns:minmax(120px,38%) 1fr;gap:6px 12px;margin:0;background:#fff;border:1px solid #e3e3e3;border-radius:12px;padding:12px}dt{font-weight:600;font-size:.9rem}dd{margin:0;font-size:.95rem}dd small{display:block;color:#555;font-size:.8rem;margin-top:2px}.ref{display:inline-block;margin-left:6px;font-size:.75rem;text-decoration:none;border:1px solid #bcd;border-radius:6px;padding:1px 6px;background:#f2f8fc}.ref span{margin-left:4px;color:#777}.summary{font-size:.95rem;line-height:1.7;margin:0 0 10px}.sym{background:#fff;border:1px solid #e3e3e3;border-radius:12px;padding:12px;margin-bottom:10px}.sym h3{margin:0 0 6px;font-size:1rem}.sym ul{margin:0;padding-left:18px}.sym li{margin:3px 0}table{border-collapse:collapse;width:100%;background:#fff;font-size:.9rem}td,th{border:1px solid #e3e3e3;padding:6px 8px;text-align:left}footer{margin-top:30px;font-size:.8rem;color:#666}@media(max-width:480px){dl{grid-template-columns:1fr}dt{margin-top:6px}}`
await mkdir(out, { recursive: true })
const entries = []
for (const maker of await readdir(src)) for (const file of await readdir(join(src, maker))) {
  if (!file.endsWith('.json') || file.endsWith('.check.json')) continue
  const entry = JSON.parse(await readFile(join(src, maker, file), 'utf8')), slug = file.replace(/\.json$/, '')
  entries.push({ maker, slug, entry })
  const items = e => e.items.map(it => `<dt>${esc(it.label)}</dt><dd>${esc(it.value)}${it.source === 'product' ? `<a class="ref" href="${esc(entry.sources.product.url)}" target="_blank" rel="noopener noreferrer">製品ページ<span>${esc(entry.sources.product.checkedAt)}</span></a>` : pageRef(entry, it.printed)}${it.note ? `<small>${esc(it.note)}</small>` : ''}</dd>`).join('')
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(entry.maker)} ${esc(entry.series)} ${esc(entry.productName)} | Nitoron カタログ解説</title><style>${css}</style></head><body><main>
<p class="kicker"><a href="../">カタログ解説</a> › ${esc(entry.maker)} › ${esc(entry.category)}</p>
<h1>${esc(entry.maker)} ${esc(entry.series)} <small>${esc(entry.productName)}</small></h1>
<p class="kicker">販売型式名 ${esc(entry.salesModel)} ／ 出典：<a href="${esc(entry.sources.product.url)}" target="_blank" rel="noopener noreferrer">製品ページ</a>（${esc(entry.sources.product.checkedAt)}確認）、<a href="${esc(entry.sources.manual.noticeUrl)}" target="_blank" rel="noopener noreferrer">取扱説明書 ${esc(entry.sources.manual.partNumber)}</a>（PDF ${entry.sources.manual.physicalPages}頁、${esc(entry.sources.manual.checkedAt)}確認）</p>
<div class="rule">この解説は公式資料を読んで自分の言葉で書いた参考情報です。原文・図は転載せず、数値には該当頁を添えています。作業の手順・条件は記載していません。必ず取扱説明書の該当頁を確認してください。${esc(entry.sources.manual.pageMap)}。</div>
${entry.elements.map(e => `<h2>${esc(e.name)}</h2><p class="summary">${esc(e.summary)}</p><dl>${items(e)}</dl>`).join('')}
<h2>症状から探す（取扱説明書の索引）</h2>
${entry.symptoms.map(s => `<div class="sym"><h3>${esc(s.symptom)}${pageRef(entry, s.printed)}</h3><ul>${s.checks.map(c => `<li>${esc(c.point)}${pageRef(entry, c.printed)}</li>`).join('')}</ul></div>`).join('')}
<h2>製品ページと取扱説明書の照合</h2>
<table><tr><th>項目</th><th>取扱説明書</th><th>製品ページ</th><th>一致</th></tr>${entry.crossCheck.map(c => `<tr><td>${esc(c.field)}</td><td>${esc(c.manual)}</td><td>${esc(c.product)}</td><td>${c.match === true ? '一致' : c.match === false ? '不一致' : '片方のみ'}</td></tr>`).join('')}</table>
<h2>未確認</h2><ul>${entry.notVerified.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
<footer>執筆 ${esc(entry.timing.start)} 〜 ${esc(entry.timing.end || '（記録中）')}／読んだ頁数 ${entry.timing.pagesRead}。取扱説明書 SHA-256 ${esc(entry.sources.manual.sha256.slice(0, 16))}…。Nitoron は株式会社クボタと関係のない非公式サイトです。</footer></main></body></html>`
  await mkdir(join(out, maker), { recursive: true })
  await writeFile(join(out, maker, `${slug}.html`), html)
}
const index = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>カタログ解説 | Nitoron</title><style>${css}</style></head><body><main><h1>カタログ解説</h1><p class="summary">公式のカタログと取扱説明書を読み、分野ごと・要素ごとに自分の言葉でまとめた参考情報です。原文・図は転載せず、数値には該当頁を添えています。手順は書いていません。</p><div class="rule">掲載 ${entries.length} 機種 ／ 非公式・メーカーとは無関係</div><dl>${entries.map(({ maker, slug, entry }) => `<dt>${esc(entry.maker)} ${esc(entry.category)}</dt><dd><a href="./${maker}/${slug}.html">${esc(entry.series)} ${esc(entry.productName)}</a></dd>`).join('')}</dl><p class="kicker"><a href="../">Nitoron へ戻る</a></p></main></body></html>`
await writeFile(join(out, 'index.html'), index)
console.log(JSON.stringify({ entries: entries.map(e => `${e.maker}/${e.slug}`), out }))
