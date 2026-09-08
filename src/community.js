import { supabase } from './supabase.js'
import { fromRow, normalize, snapshot, publicationProblems } from './domain.js'
export const PAGE_SIZE = 24
export const FEEDBACK_KINDS = ['質問', '指摘', '提案', '試した結果']
const message = error => ['PGRST205', '42P01'].includes(error?.code)
  ? '公開・指摘の保存先は準備中です。自分の記録は引き続き利用できます。'
  : '読み込み・保存ができませんでした。接続を確認して再試行してください。'
const requireClient = () => { if (!supabase) throw new Error('クラウドに接続できません。') }
const unpack = row => ({ ...fromRow(row.snapshot), id: row.id, publication: { id: row.id, owner: row.owner_id, publishedAt: row.published_at, updatedAt: row.updated_at, isPublic: row.is_public } })
export async function listPublic({ query = '', region = '', page = 0 } = {}) {
  requireClient()
  let request = supabase.from('nitoron_publications').select('*', { count: 'exact' }).eq('is_public', true)
  for (const term of normalize(query).split(/\s+/).filter(Boolean)) request = request.ilike('search_text', `%${term.replace(/[\\%_]/g, '\\$&')}%`)
  if (region.trim()) request = request.ilike('snapshot->meta->>region', `%${region.trim().replace(/[\\%_]/g, '\\$&')}%`)
  const { data, error, count } = await request.order('updated_at', { ascending: false }).order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  if (error) throw new Error(message(error))
  return { records: data.map(unpack), count }
}
export async function getPublic(id) {
  requireClient()
  const { data, error } = await supabase.from('nitoron_publications').select('*').eq('id', id).eq('is_public', true).maybeSingle()
  if (error) throw new Error(message(error))
  if (!data) throw new Error('この発表は見つからないか、公開が停止されています。')
  return unpack(data)
}
export async function getOwned(userId) {
  requireClient()
  const { data, error } = await supabase.from('nitoron_publications').select('id,is_public,updated_at').eq('owner_id', userId)
  if (error) throw new Error(message(error))
  return data
}
export async function publishRecord(record, session) {
  requireClient()
  if (!session?.user || session.user.is_anonymous || !session.user.email_confirmed_at) throw new Error('メールアドレスを確認してから公開してください。')
  const problems = publicationProblems(record)
  if (problems.length) throw new Error(problems.join('\n'))
  const { error } = await supabase.from('nitoron_publications').upsert({ id: record.id, owner_id: session.user.id, snapshot: snapshot(record), is_public: true }).select('id').single()
  if (error) throw new Error(message(error))
  return record.id
}
export async function unpublishRecord(id, userId) {
  requireClient()
  const { data, error } = await supabase.from('nitoron_publications').update({ is_public: false }).eq('id', id).eq('owner_id', userId).select('id').maybeSingle()
  if (error || !data) throw new Error('公開を停止できませんでした。再試行してください。')
}
export async function listFeedback(id) {
  requireClient()
  const { data, error } = await supabase.from('nitoron_feedback').select('*').eq('publication_id', id).order('created_at', { ascending: false }).limit(100)
  if (error) throw new Error(message(error))
  return data
}
export async function postFeedback(id, session, { author, kind, section, body }) {
  requireClient()
  if (!session?.user || session.user.is_anonymous || !session.user.email_confirmed_at) throw new Error('メールアドレスを確認してから投稿してください。')
  if (!author.trim() || !body.trim()) throw new Error('表示名と内容を入力してください。')
  const { error } = await supabase.from('nitoron_feedback').insert({ publication_id: id, user_id: session.user.id, author: author.trim(), kind, section, body: body.trim() }).select('id').single()
  if (error) throw new Error(error.code === 'P0001' ? '投稿間隔をあけて、もう一度お試しください。' : message(error))
}
export async function deleteFeedback(id) {
  requireClient()
  const { data, error } = await supabase.from('nitoron_feedback').delete().eq('id', id).select('id').maybeSingle()
  if (error || !data) throw new Error('指摘を削除できませんでした。')
}
