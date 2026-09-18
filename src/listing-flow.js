import { number, safeUrl } from './domain.js'

export const LISTING_STEPS = ['intro', 'kind', 'details', 'photos', 'title', 'description', 'review']
export const LISTING_PHASES = [
  { title: '基本情報を教えてください', description: '記録の種類や、作物・機械、地域を選びます。', icon: 'book', steps: ['kind', 'details'] },
  { title: '写真と説明を加えましょう', description: '写真、タイトル、伝えたい内容を整えます。', icon: 'pencil', steps: ['photos', 'title', 'description'] },
  { title: '確認して、掲載しましょう', description: '実際の見え方を確認したら、掲載できます。', icon: 'check', steps: ['review'] },
]
export const listingStepKey = (owner, id) => `nitoron:listing-step:v1:${owner || 'device'}:${id}`
export const resolveListingStep = (requested, saved) => LISTING_STEPS.includes(requested) ? requested : LISTING_STEPS.includes(saved) ? saved : 'intro'
export function listingStepProblem(record, step) {
  const m = record.meta
  if (step === 'title' && !record.title.trim()) return 'タイトルを入力してください。'
  if (step === 'photos' && m.coverUrl && !safeUrl(m.coverUrl)) return '写真のURLは https:// または http:// から入力してください。'
  if (step === 'details') {
    if (m.start && m.end && m.start > m.end) return '期間の終了日は、開始日以降にしてください。'
    if (m.areaA !== '' && !(number(m.areaA) > 0)) return '面積は0より大きい数値を入力してください。'
  }
  return ''
}
