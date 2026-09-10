// 機種台帳（分野⑦拡張・型式アトラス）。表記を照合用に整えるが、元の入力・型式末尾は保持する。
import { createHash } from 'node:crypto'

// 照合用の正規化。全角半角・大小文字・空白・中点を整える。仕様記号は落とさない。
export const normalizeModelText = value => String(value || '')
  .normalize('NFKC').toLowerCase().replace(/[・･]/g, ' ').replace(/\s+/g, ' ').trim()

// 登録済み機種。SKP-101Wは既存成果物（vendor/parts-lab）をそのまま1機種として登録する。
export const REGISTRY = [
  {
    machineId: 'skp-101w', maker: 'クボタ', model: 'SKP-101W', name: 'クボタ SKP-101W',
    category: 'walk-behind-transplanter',
    aliases: ['クボタ skp-101w', 'kubota skp-101w', 'skp-101w', 'skp101w'],
    modelVersion: 'skp-101w@daf7afab', status: 'available', artifact: 'vendor/parts-lab',
  },
]

// メーカー別の公式取得先（接続部）。検索サービス・取得先は交換可能にする。
// ルートはメーカー単位の設定であり、機種ごとのURL手入力ではない。
export const MAKERS = [
  { key: 'honda', names: ['ホンダ', 'honda', '本田技研'], publisher: 'Honda',
    roots: ['https://www.honda.co.jp/tiller/', 'https://www.honda.co.jp/power/'] },
  { key: 'kubota', names: ['クボタ', 'kubota'], publisher: 'Kubota',
    roots: ['https://agriculture.kubota.co.jp/'] },
  { key: 'yanmar', names: ['ヤンマー', 'yanmar'], publisher: 'Yanmar',
    roots: ['https://www.yanmar.com/jp/agri/'] },
]

// 入力（メーカー名・型式）の解釈。先頭のメーカー語を分離し、残りを型式トークンとする。
export function parseInput(raw) {
  const original = String(raw || '')
  const normalized = normalizeModelText(original)
  const maker = MAKERS.find(m => m.names.some(n => normalized.startsWith(normalizeModelText(n))))
  if (maker) {
    const prefix = normalizeModelText(maker.names.find(n => normalized.startsWith(normalizeModelText(n))))
    return { original, normalized, maker, modelToken: normalized.slice(prefix.length).trim() }
  }
  // 台帳にないメーカー語でも、数字を含む末尾の語を型式トークンとして分離する（勝手に確定はしない）
  const words = normalized.split(' ')
  const modelWords = []
  while (words.length && /\d/.test(words[words.length - 1])) modelWords.unshift(words.pop())
  return { original, normalized, maker: null, makerText: words.join(' '), modelToken: modelWords.join(' ') || normalized }
}

// 台帳照合。確定（registered）／未登録（unregistered）／入力不足を区別し、推測で確定しない。
export function identify(raw) {
  const parsed = parseInput(raw)
  if (!parsed.modelToken) return { status: 'need-input', parsed }
  const hit = REGISTRY.find(entry => entry.aliases.some(a => normalizeModelText(a) === parsed.normalized || normalizeModelText(a) === parsed.modelToken))
  if (hit) return { status: 'registered', parsed, machine: hit }
  return { status: 'unregistered', parsed, machineId: slugify(parsed) }
}

const slugify = parsed => [parsed.maker?.key, parsed.modelToken.replace(/[^a-z0-9]+/g, '-')].filter(Boolean).join('-').replace(/^-|-$/g, '')
export const sha256 = value => createHash('sha256').update(value).digest('hex')
