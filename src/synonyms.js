import { normalize } from './domain.js'
// 同義語・表記揺れの対応表。検索語がいずれかの語と完全一致したとき、同じ組の語をまとめて探す（部分一致だけの拡張はしない）。
// 展開した語は画面に明示する。AIによる推測検索は行わない。
export const SYNONYM_GROUPS = [
  ['水稲', '稲', 'イネ', '米', 'コメ', '稲作'],
  ['育苗', '苗', '播種', '種まき', '種蒔き', '苗づくり'],
  ['土づくり', '土作り', '土壌改良', '土壌', '堆肥', '緑肥'],
  ['省力化', '効率化', '時短', '自動化', '労働時間'],
  ['ブロッコリー', 'ブロッコリ', '花蕾'],
  ['トマト', 'ミニトマト', '桃太郎'],
  ['排水', '排水対策', '冠水', '湿害', '明渠', '暗渠'],
  ['病害虫', '病気', '害虫', '防除', '農薬'],
  ['施肥', '肥料', '追肥', '元肥'],
  ['収量', '収穫量', '増収', '反収'],
  ['販路', '販売', '直売', '出荷'],
  ['キャベツ', 'きゃべつ'],
  ['ニンジン', '人参', 'にんじん'],
  ['ジャガイモ', 'じゃがいも', '馬鈴薯', 'ばれいしょ'],
  ['サツマイモ', 'さつまいも', '甘藷', 'かんしょ'],
  ['ダイコン', '大根', 'だいこん'],
  ['ネギ', 'ねぎ', '葱', '長ねぎ'],
  ['タマネギ', '玉ねぎ', 'たまねぎ', '玉葱'],
  ['イチゴ', 'いちご', '苺'],
  ['ハウス', 'ビニールハウス', '施設', '温室'],
]
export const canonicalOf = term => { const n = normalize(term).trim(); return SYNONYM_GROUPS.find(g => g.some(w => normalize(w) === n))?.[0] || null }
// 1語を検索用の候補語（正規化済み）に展開する。対応表にない語はそのまま。
export function expandTerm(term) {
  const n = normalize(term).trim()
  if (!n) return { term, alternatives: [] }
  const group = SYNONYM_GROUPS.find(g => g.some(w => normalize(w) === n))
  const alternatives = group ? [...new Set(group.map(normalize))] : [n]
  return { term, alternatives, expanded: group ? group.filter(w => normalize(w) !== n) : [] }
}
// exact=true のときは同義語を展開しない（入力した語だけで探す）。
export const expandQuery = (query, exact = false) => normalize(query).split(/\s+/).filter(Boolean).map(t => exact ? { term: t, alternatives: [t], expanded: [] } : expandTerm(t))
export const hasExpansion = query => expandQuery(query).some(t => t.expanded.length)
// 「いね」→「水稲」のように、対応表から候補語（代表語）を引く。
export function suggestFromSynonyms(input) {
  const n = normalize(input).trim()
  if (!n) return []
  return SYNONYM_GROUPS.filter(g => g.some(w => normalize(w).startsWith(n) || normalize(w).includes(n))).map(g => g[0])
}
export const PREFECTURES = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県']
// 「とく」「tokushima」相当の読みは持たない。ひらがな・カタカナ・漢字の前方一致と、県名の読みの一部（先頭かな）に対応する。
const PREFECTURE_KANA = { 北海道: 'ほっかいどう', 青森県: 'あおもり', 岩手県: 'いわて', 宮城県: 'みやぎ', 秋田県: 'あきた', 山形県: 'やまがた', 福島県: 'ふくしま', 茨城県: 'いばらき', 栃木県: 'とちぎ', 群馬県: 'ぐんま', 埼玉県: 'さいたま', 千葉県: 'ちば', 東京都: 'とうきょう', 神奈川県: 'かながわ', 新潟県: 'にいがた', 富山県: 'とやま', 石川県: 'いしかわ', 福井県: 'ふくい', 山梨県: 'やまなし', 長野県: 'ながの', 岐阜県: 'ぎふ', 静岡県: 'しずおか', 愛知県: 'あいち', 三重県: 'みえ', 滋賀県: 'しが', 京都府: 'きょうと', 大阪府: 'おおさか', 兵庫県: 'ひょうご', 奈良県: 'なら', 和歌山県: 'わかやま', 鳥取県: 'とっとり', 島根県: 'しまね', 岡山県: 'おかやま', 広島県: 'ひろしま', 山口県: 'やまぐち', 徳島県: 'とくしま', 香川県: 'かがわ', 愛媛県: 'えひめ', 高知県: 'こうち', 福岡県: 'ふくおか', 佐賀県: 'さが', 長崎県: 'ながさき', 熊本県: 'くまもと', 大分県: 'おおいた', 宮崎県: 'みやざき', 鹿児島県: 'かごしま', 沖縄県: 'おきなわ' }
export function suggestPrefectures(input) {
  const n = normalize(input).trim()
  if (!n) return []
  return PREFECTURES.filter(p => p.startsWith(n) || normalize(p).startsWith(n) || PREFECTURE_KANA[p].startsWith(n))
}
// 課題の候補語（データに依存しない基本語彙）。データから取れる作物・地域と合わせて候補に出す。
export const ISSUE_WORDS = ['育苗', '土づくり', '省力化', '排水', '病害虫', '施肥', '収量', '品質', '販路', '労働時間', '経費', '灌水', '除草', '連作', 'マルチ', 'ハウス']
