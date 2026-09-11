// 資料取得。公開HTTPSのみ・リダイレクトのホスト検査・再試行と予算の上限つき。
// 全取得に出所（URL・発行元・取得日時・ハッシュ・状態）を記録する。fixture:// はモック用。
import { readFile } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import { sha256 } from './registry.mjs'

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1)/i
export function createFetcher({ fixtureDir = null, maxPages = 20, maxMillis = 120000, retries = 1 } = {}) {
  const provenance = []
  const started = Date.now()
  let pages = 0
  const record = entry => { provenance.push(entry); return entry }
  return {
    provenance,
    kind: fixtureDir ? 'fixture' : 'live',
    async fetchText(url, { targetModel = '' } = {}) {
      const fetchedAt = new Date().toISOString()
      if (Date.now() - started > maxMillis) return record({ url, fetchedAt, status: 'budget-time', targetModel })
      if (++pages > maxPages) return record({ url, fetchedAt, status: 'budget-pages', targetModel })
      if (fixtureDir) {
        // モック経路：ローカルフィクスチャ。実データ取得とは別集計にする。
        try {
          const path = normalize(join(fixtureDir, url.replace(/^fixture:\/\//, '')))
          if (!path.startsWith(normalize(fixtureDir))) throw new Error('fixture path escape')
          const body = await readFile(path, 'utf8')
          return record({ url, fetchedAt, status: 'ok', source: 'fixture', publisher: 'fixture', sha256: sha256(body), bytes: body.length, targetModel, body })
        } catch (e) { return record({ url, fetchedAt, status: 'not-found', source: 'fixture', error: e.message, targetModel }) }
      }
      let parsed
      try { parsed = new URL(url) } catch { return record({ url, fetchedAt, status: 'bad-url', targetModel }) }
      if (parsed.protocol !== 'https:' || PRIVATE_HOST.test(parsed.hostname)) return record({ url, fetchedAt, status: 'refused-target', targetModel })
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000) })
          if ([301, 302, 307, 308].includes(res.status)) {
            const next = new URL(res.headers.get('location'), url)
            if (next.protocol !== 'https:' || PRIVATE_HOST.test(next.hostname)) return record({ url, fetchedAt, status: 'refused-redirect', redirect: next.href, targetModel })
            url = next.href; continue
          }
          // 実行環境のegressゲートウェイによる拒否は、サイト側の応答と区別して記録する
          const denyReason = res.headers.get('x-deny-reason')
          if (denyReason) return record({ url, fetchedAt, status: 'network-blocked', denyReason, publisher: parsed.hostname, targetModel })
          if (!res.ok) return record({ url, fetchedAt, status: `http-${res.status}`, publisher: parsed.hostname, targetModel })
          const contentType = res.headers.get('content-type') || ''
          const body = await res.text()
          // PDFは出所（URL・ハッシュ）を記録するが、本文抽出は未対応として区別する
          return record({ url, fetchedAt, status: 'ok', source: 'live', publisher: parsed.hostname, contentType, pdf: /pdf/i.test(contentType) || /\.pdf($|\?)/i.test(url), sha256: sha256(body), bytes: body.length, targetModel, body })
        } catch (e) {
          // 本環境ではegressポリシーの拒否がここに現れる（プロキシCONNECT 403 → fetch failed）。
          if (attempt >= retries) return record({ url, fetchedAt, status: 'network-blocked', publisher: parsed.hostname, error: String(e.cause?.message || e.message), targetModel })
        }
      }
    },
  }
}
