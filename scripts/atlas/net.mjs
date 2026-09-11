// 資料取得。公開HTTPSのみ・リダイレクトのホスト検査・再試行と予算の上限つき。
// 全取得に出所（URL・発行元・取得日時・ハッシュ・状態）を記録する。fixture:// はモック用。
// 失敗は「ポリシー拒否・DNS・TLS・タイムアウト・HTTPエラー・接続断・原因不明」を区別して記録する。
import { readFile } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { connect as tlsConnect } from 'node:tls'
import { sha256 } from './registry.mjs'

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1)/i
const MAX_REDIRECTS = 5

// 実行環境のegressプロキシ（https_proxy）。回避はせず、設定があればそれを経由する。
const proxyUrl = () => {
  const raw = process.env.https_proxy || process.env.HTTPS_PROXY
  if (!raw) return null
  try { return new URL(raw) } catch { return null }
}

// プロキシへCONNECTを送り、結果を返す。403等はegressポリシーの拒否として分類に使う。
const openTunnel = (proxy, host, port, timeoutMs) => new Promise(resolve => {
  const req = httpRequest({ host: proxy.hostname, port: proxy.port, method: 'CONNECT', path: `${host}:${port}`, timeout: timeoutMs })
  req.on('connect', (res, socket) => {
    if (res.statusCode === 200) return resolve({ socket })
    socket.destroy()
    resolve({ connectStatus: res.statusCode, denyReason: res.headers['x-deny-reason'] || null })
  })
  req.on('timeout', () => { req.destroy(new Error('proxy connect timeout')) })
  req.on('error', error => resolve({ error }))
  req.end()
})

// 1リクエスト（リダイレクトは辿らない）。本文はバイト列のまま返す（PDF破損を防ぐ）。
async function requestOnce(url, timeoutMs) {
  const target = new URL(url)
  const port = Number(target.port || 443)
  const options = {
    method: 'GET', host: target.hostname, port, path: target.pathname + target.search, servername: target.hostname,
    headers: { host: target.host, 'user-agent': 'nitoron-atlas/0.1 (+public materials fetch)', accept: 'text/html,application/pdf,*/*;q=0.8', 'accept-language': 'ja,en;q=0.8' },
    timeout: timeoutMs,
  }
  const proxy = proxyUrl()
  if (proxy) {
    const tunnel = await openTunnel(proxy, target.hostname, port, timeoutMs)
    if (!tunnel.socket) return { failure: tunnel.error ? { kind: 'connection-error', detail: tunnel.error.message } : { kind: 'network-blocked', detail: `proxy CONNECT ${tunnel.connectStatus}`, denyReason: tunnel.denyReason } }
    options.createConnection = (_opts, done) => {
      const tls = tlsConnect({ socket: tunnel.socket, servername: target.hostname })
      tls.on('secureConnect', () => done(null, tls))
      tls.on('error', error => done(error))
      return undefined
    }
  }
  return await new Promise(resolve => {
    const req = httpsRequest(options, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, bodyBytes: Buffer.concat(chunks) }))
      res.on('error', error => resolve({ failure: classifyError(error) }))
    })
    req.on('timeout', () => req.destroy(Object.assign(new Error('request timeout'), { code: 'ETIMEDOUT' })))
    req.on('error', error => resolve({ failure: classifyError(error) }))
    req.end()
  })
}

// エラーオブジェクト→失敗分類。断定できないものは unknown-error のまま残す。
export function classifyError(error) {
  const code = error?.code || error?.cause?.code || ''
  const message = String(error?.cause?.message || error?.message || error)
  if (/ENOTFOUND|EAI_AGAIN|EAI_FAIL/.test(code)) return { kind: 'dns-error', detail: message }
  if (/ETIMEDOUT|ESOCKETTIMEDOUT/.test(code) || /timeout/i.test(message)) return { kind: 'timeout', detail: message }
  if (/CERT|UNABLE_TO_VERIFY|SELF_SIGNED|ERR_TLS|EPROTO|HANDSHAKE/i.test(code) || /certificate|TLS|SSL/i.test(message)) return { kind: 'tls-error', detail: message }
  if (/ECONNREFUSED|ECONNRESET|EPIPE|EHOSTUNREACH|ENETUNREACH/.test(code)) return { kind: 'connection-error', detail: message }
  return { kind: 'unknown-error', detail: message }
}

export function createFetcher({ fixtureDir = null, maxPages = 20, maxMillis = 120000, retries = 1, timeoutMs = 20000 } = {}) {
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
          const isPdf = /\.pdf$/i.test(path)
          const body = await readFile(path, isPdf ? undefined : 'utf8')
          return record({ url, fetchedAt, status: 'ok', source: 'fixture', publisher: 'fixture', pdf: isPdf || undefined, sha256: sha256(body), bytes: body.length, targetModel, body })
        } catch (e) { return record({ url, fetchedAt, status: 'not-found', source: 'fixture', error: e.message, targetModel }) }
      }
      let parsed
      try { parsed = new URL(url) } catch { return record({ url, fetchedAt, status: 'bad-url', targetModel }) }
      if (parsed.protocol !== 'https:' || PRIVATE_HOST.test(parsed.hostname)) return record({ url, fetchedAt, status: 'refused-target', targetModel })
      let redirects = 0
      for (let attempt = 0; ; ) {
        const res = await requestOnce(url, timeoutMs)
        if (res.failure) {
          // 一過性でない分類（ポリシー拒否・DNS・TLS）は再試行しない。接続断・タイムアウトのみ再試行する。
          const retryable = ['timeout', 'connection-error', 'unknown-error'].includes(res.failure.kind)
          if (retryable && attempt < retries) { attempt++; continue }
          return record({ url, fetchedAt, status: res.failure.kind, error: res.failure.detail, denyReason: res.failure.denyReason, publisher: parsed.hostname, targetModel })
        }
        if ([301, 302, 303, 307, 308].includes(res.status)) {
          if (++redirects > MAX_REDIRECTS) return record({ url, fetchedAt, status: 'redirect-loop', publisher: parsed.hostname, targetModel })
          let next
          try { next = new URL(res.headers.location, url) } catch { return record({ url, fetchedAt, status: 'bad-redirect', publisher: parsed.hostname, targetModel }) }
          if (next.protocol !== 'https:' || PRIVATE_HOST.test(next.hostname)) return record({ url, fetchedAt, status: 'refused-redirect', redirect: next.href, targetModel })
          url = next.href; parsed = next; continue
        }
        // egressゲートウェイの明示拒否（x-deny-reason）は、サイト側の応答と区別して記録する
        const denyReason = res.headers['x-deny-reason']
        if (denyReason) return record({ url, fetchedAt, status: 'network-blocked', denyReason, publisher: parsed.hostname, targetModel })
        if (res.status < 200 || res.status >= 300) {
          // サイト側のHTTPエラー。応答したサーバー（CDN等）も記録し、ポリシー拒否と混同しない。
          return record({ url, fetchedAt, status: `http-${res.status}`, refusedBy: 'site', server: res.headers.server || null, publisher: parsed.hostname, targetModel })
        }
        const contentType = res.headers['content-type'] || ''
        const isPdf = /pdf/i.test(contentType) || /\.pdf($|\?)/i.test(url)
        // PDFはバイト列を保持（テキスト化で破損させない）。HTMLはUTF-8文字列にする。
        const body = isPdf ? res.bodyBytes : res.bodyBytes.toString('utf8')
        return record({ url, fetchedAt, status: 'ok', source: 'live', publisher: parsed.hostname, contentType, pdf: isPdf, sha256: sha256(res.bodyBytes), bytes: res.bodyBytes.length, targetModel, body })
      }
    },
  }
}
