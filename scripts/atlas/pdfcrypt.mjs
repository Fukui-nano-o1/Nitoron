// PDF標準セキュリティハンドラの復号（空ユーザーパスワードのみ）。
// メーカー配布の取説PDFは「誰でも閲覧可・印刷等のみ制限」の暗号化が多く、
// 空パスワードで開けない（実際にパスワード保護された）文書は password-protected として抽出しない。
// 対応：V5/R5-6（AES-256）、V4/R4（AESV2=AES-128・V2=RC4-128）、V1-2（RC4）。
import { createHash, createDecipheriv, createCipheriv } from 'node:crypto'

const PAD = Buffer.from('28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A', 'hex')
const md5 = data => createHash('md5').update(data).digest()
const sha256 = data => createHash('sha256').update(data).digest()

// RC4（旧PDFの標準暗号。OpenSSL側で無効化されていても動くよう自前実装）
function rc4(key, data) {
  const S = new Uint8Array(256)
  for (let i = 0; i < 256; i++) S[i] = i
  let j = 0
  for (let i = 0; i < 256; i++) { j = (j + S[i] + key[i % key.length]) & 255; [S[i], S[j]] = [S[j], S[i]] }
  const out = Buffer.alloc(data.length)
  let i = 0; j = 0
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 255; j = (j + S[i]) & 255; [S[i], S[j]] = [S[j], S[i]]
    out[k] = data[k] ^ S[(S[i] + S[j]) & 255]
  }
  return out
}

const aesCbc = (dir, bits, key, iv, data) => {
  const cipher = (dir === 'enc' ? createCipheriv : createDecipheriv)(`aes-${bits}-cbc`, key, iv)
  cipher.setAutoPadding(false)
  return Buffer.concat([cipher.update(data), cipher.final()])
}

const stripPkcs7 = data => {
  const n = data[data.length - 1]
  return n >= 1 && n <= 16 && n <= data.length ? data.subarray(0, data.length - n) : data
}

// AES系ストリーム：先頭16バイトがIV
const aesDecryptStream = (bits, key, data) => {
  if (data.length < 16 || (data.length - 16) % 16 !== 0) return null
  try { return stripPkcs7(aesCbc('dec', bits, key, data.subarray(0, 16), data.subarray(16))) } catch { return null }
}

// R6（AES-256）のハッシュ（ISO 32000-2 Algorithm 2.B）
function hash2B(password, salt, udata) {
  let K = sha256(Buffer.concat([password, salt, udata]))
  let round = 0, E
  do {
    const K1 = Buffer.concat(Array(64).fill(Buffer.concat([password, K, udata])))
    E = aesCbc('enc', 128, K.subarray(0, 16), K.subarray(16, 32), K1)
    let sum = 0
    for (let i = 0; i < 16; i++) sum += E[i]
    K = createHash(['sha256', 'sha384', 'sha512'][sum % 3]).update(E).digest()
    round++
  } while (round < 64 || E[E.length - 1] > round - 32)
  return K.subarray(0, 32)
}

// 旧形式（R2-4）のファイルキー（Algorithm 2）。パスワードは空のみ。
function legacyFileKey({ O, P, id, R, keyBytes, encryptMetadata }) {
  const pBuf = Buffer.alloc(4)
  pBuf.writeInt32LE(P | 0)
  const pieces = [PAD, O.subarray(0, 32), pBuf, id]
  if (R >= 4 && !encryptMetadata) pieces.push(Buffer.from('ffffffff', 'hex'))
  let key = md5(Buffer.concat(pieces))
  if (R >= 3) for (let i = 0; i < 50; i++) key = md5(key.subarray(0, keyBytes))
  return key.subarray(0, keyBytes)
}

// 空ユーザーパスワードの検証（Algorithm 4/5/11）。不一致ならパスワード保護と判定する。
function validateEmptyUser({ R, U, id, fileKey }) {
  if (R >= 5) return hash2B(Buffer.alloc(0), U.subarray(32, 40), Buffer.alloc(0)).equals(U.subarray(0, 32))
  if (R === 2) return rc4(fileKey, PAD).equals(U.subarray(0, 32))
  // R3-4：md5(PAD+ID)をRC4で19回鍵変形しながら暗号化した先頭16バイト
  let data = md5(Buffer.concat([PAD, id]))
  for (let i = 0; i <= 19; i++) {
    const step = Buffer.from(fileKey)
    for (let k = 0; k < step.length; k++) step[k] ^= i
    data = rc4(step, data)
  }
  return data.subarray(0, 16).equals(U.subarray(0, 16))
}

// Encrypt辞書＋文書ID → ストリーム復号器。失敗理由は error で返す（推測で続行しない）。
export function createDecryptor({ V, R, O, U, UE, P, id, length, cfm, encryptMetadata = true }) {
  if (![1, 2, 4, 5].includes(V)) return { error: `unsupported-encryption-v${V}` }
  if (V === 5) {
    if (!U || U.length < 48 || !UE || UE.length < 32) return { error: 'malformed-encryption' }
    if (!validateEmptyUser({ R, U })) return { error: 'password-protected' }
    const intermediate = hash2B(Buffer.alloc(0), U.subarray(40, 48), Buffer.alloc(0))
    let fileKey
    try { fileKey = aesCbc('dec', 256, intermediate, Buffer.alloc(16), UE.subarray(0, 32)) } catch { return { error: 'malformed-encryption' } }
    return { decryptStream: data => aesDecryptStream(256, fileKey, data), decryptsStrings: true, mode: 'aes-256' }
  }
  const keyBytes = V === 1 ? 5 : Math.max(5, Math.min(16, Math.floor((length || 40) / 8)))
  const fileKey = legacyFileKey({ O, P, id, R, keyBytes, encryptMetadata })
  if (!validateEmptyUser({ R, U, id, fileKey })) return { error: 'password-protected' }
  const useAes = V === 4 && cfm === 'AESV2'
  const objKey = (num, gen) => {
    const tail = Buffer.from([num & 255, (num >> 8) & 255, (num >> 16) & 255, gen & 255, (gen >> 8) & 255])
    const salted = useAes ? Buffer.concat([fileKey, tail, Buffer.from('73416c54', 'hex')]) : Buffer.concat([fileKey, tail])
    return md5(salted).subarray(0, Math.min(fileKey.length + 5, 16))
  }
  return {
    decryptStream: (data, num, gen = 0) => useAes ? aesDecryptStream(128, objKey(num, gen), data) : rc4(objKey(num, gen), data),
    decryptsStrings: true, mode: useAes ? 'aes-128' : `rc4-${keyBytes * 8}`,
  }
}
