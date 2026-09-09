import { supabase } from './supabase.js'
import { fromRow, normalize, snapshot, publicationProblems } from './domain.js'
import { EMPTY_FILTERS } from './search.js'
export const PAGE_SIZE = 24
export const FEEDBACK_KINDS = ['質問', '指摘', '提案', '試した結果']
const message = error => ['PGRST205', '42P01'].includes(error?.code)
  ? '公開・指摘の保存先は準備中です。自分の記録は引き続き利用できます。'
  : '読み込み・保存ができませんでした。接続を確認して再試行してください。'
const requireClient = () => { if (!supabase) throw new Error('クラウドに接続できません。') }
const unpack = row => ({ ...fromRow(row.snapshot), id: row.id, publication: { id: row.id, owner: row.owner_id, publishedAt: row.published_at, updatedAt: row.updated_at, isPublic: row.is_public } })
export async function listPublic({ query = '', region = '', page = 0, filters = EMPTY_FILTERS, sort = 'recent', bookmarkedBy, limit = PAGE_SIZE } = {}) {
  requireClient()
  if (bookmarkedBy === null) return { records: [], count: 0 }
  let request = supabase.from('nitoron_publications').select(bookmarkedBy ? '*,nitoron_bookmarks!inner(user_id)' : '*', { count: 'exact' }).eq('is_public', true)
  for (const term of normalize(query).split(/\s+/).filter(Boolean)) request = request.ilike('search_text', `%${term.replace(/[\\%_]/g, '\\$&')}%`)
  if (region.trim()) request = request.ilike('region_search', `%${normalize(region).trim().replace(/[\\%_]/g, '\\$&')}%`)
  if (filters.crop.trim()) request = request.ilike('crop_search', `%${normalize(filters.crop).trim().replace(/[\\%_]/g, '\\$&')}%`)
  if (filters.kind !== 'all') request = request.eq('snapshot->meta->>kind', filters.kind)
  if (filters.stage !== 'all') request = request.eq('snapshot->meta->>kind', 'challenge').eq('snapshot->meta->>stage', filters.stage)
  if (filters.from) request = request.gte('snapshot->>date', filters.from)
  if (filters.to) request = request.lte('snapshot->>date', filters.to)
  if (filters.numbers) request = request.eq('has_metrics', true)
  if (bookmarkedBy) request = request.eq('nitoron_bookmarks.user_id', bookmarkedBy)
  request = sort === 'title' ? request.order('title_search') : request.order('updated_at', { ascending: false })
  const { data, error, count } = await request.order('id').range(page * PAGE_SIZE, page * PAGE_SIZE + Math.min(limit, PAGE_SIZE) - 1)
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
export async function getProfile(userId) {
  requireClient()
  const { data, error } = await supabase.from('nitoron_profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(message(error))
  return data
}
export async function saveProfile(session, { display_name, region, club, bio }) {
  requireClient()
  if (!session?.user) throw new Error('ログインしてからプロフィールを保存してください。')
  const { error } = await supabase.from('nitoron_profiles').upsert({ user_id: session.user.id, display_name: display_name.trim(), region: region.trim(), club: club.trim(), bio: bio.trim(), updated_at: new Date().toISOString() }).select('user_id').single()
  if (error) throw new Error('プロフィールを保存できませんでした。接続を確認して再試行してください。')
}
// 公開の対話記録から検証できる実績だけを数える。自己申告は含めない。
export async function getTrust(userId, publicationIds) {
  requireClient()
  const count = async request => { const { count: n, error } = await request; if (error) throw new Error(message(error)); return n || 0 }
  const [received, resolved, written, replies] = await Promise.all([
    publicationIds.length ? count(supabase.from('nitoron_feedback').select('id', { count: 'exact', head: true }).in('publication_id', publicationIds)) : 0,
    publicationIds.length ? count(supabase.from('nitoron_feedback_resolutions').select('feedback_id', { count: 'exact', head: true }).in('publication_id', publicationIds).eq('status', '対応済み')) : 0,
    count(supabase.from('nitoron_feedback').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
    count(supabase.from('nitoron_feedback_replies').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
  ])
  return { received, resolved, contributions: written + replies }
}
export async function getUserPublic(ownerId) {
  requireClient()
  const { data, error } = await supabase.from('nitoron_publications').select('*').eq('owner_id', ownerId).eq('is_public', true).order('updated_at', { ascending: false }).order('id').limit(60)
  if (error) throw new Error(message(error))
  return data.map(unpack)
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

export async function listBookmarks(userId) {
  requireClient()
  const rows = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('nitoron_bookmarks').select('publication_id,created_at').eq('user_id', userId).order('publication_id').range(offset, offset + 499)
    if (error) throw new Error('保存リストを取得できませんでした。')
    rows.push(...data.map(r => ({ id: r.publication_id, savedAt: r.created_at }))); if (data.length < 500) return rows
  }
}
export async function listNewActivity(userId, items) {
  requireClient()
  if (!items.length) return {}
  const ids = items.map(i => i.id), since = {}
  for (const item of items) since[item.id] = item.since
  const { data: seen, error: seenError } = await supabase.from('nitoron_publication_seen').select('publication_id,seen_at').eq('user_id', userId).in('publication_id', ids)
  if (seenError) throw new Error(message(seenError))
  for (const row of seen) if (row.seen_at > (since[row.publication_id] || '')) since[row.publication_id] = row.seen_at
  const floor = Object.values(since).sort()[0]
  const query = table => supabase.from(table).select('publication_id,created_at').in('publication_id', ids).neq('user_id', userId).gt('created_at', floor).limit(1000)
  const [feedback, replies] = await Promise.all([query('nitoron_feedback'), query('nitoron_feedback_replies')])
  if (feedback.error || replies.error) throw new Error(message(feedback.error || replies.error))
  const counts = {}
  for (const row of [...feedback.data, ...replies.data]) if (row.created_at > since[row.publication_id]) counts[row.publication_id] = (counts[row.publication_id] || 0) + 1
  return counts
}
export async function markActivitySeen(userId, publicationId) {
  requireClient()
  const { error } = await supabase.from('nitoron_publication_seen').upsert({ user_id: userId, publication_id: publicationId, seen_at: new Date().toISOString() }, { onConflict: 'user_id,publication_id' })
  if (error) throw new Error('新着の既読を保存できませんでした。')
}
export async function setBookmark(userId, id, saved) {
  requireClient()
  const request = saved ? supabase.from('nitoron_bookmarks').upsert({ user_id: userId, publication_id: id }, { onConflict: 'user_id,publication_id', ignoreDuplicates: true })
    : supabase.from('nitoron_bookmarks').delete().eq('user_id', userId).eq('publication_id', id)
  const { error } = await request
  if (error) throw new Error('保存リストを更新できませんでした。再試行してください。')
}
export async function listFollows(userId) {
  requireClient()
  const { data, error } = await supabase.from('nitoron_follows').select('owner_id').eq('follower_id', userId).order('owner_id').limit(1000)
  if (error) throw new Error(message(error))
  return data.map(r => r.owner_id)
}
export async function setFollow(userId, ownerId, following) {
  requireClient()
  const request = following ? supabase.from('nitoron_follows').upsert({ follower_id: userId, owner_id: ownerId }, { onConflict: 'follower_id,owner_id', ignoreDuplicates: true })
    : supabase.from('nitoron_follows').delete().eq('follower_id', userId).eq('owner_id', ownerId)
  const { error } = await request
  if (error) throw new Error(['PGRST205', '42P01'].includes(error.code) ? message(error) : 'フォローを更新できませんでした。再試行してください。')
}
export async function getCardMemo(userId, publicationId) {
  requireClient()
  const { data, error } = await supabase.from('nitoron_card_memos').select('body').eq('user_id', userId).eq('publication_id', publicationId).maybeSingle()
  if (error) throw new Error(message(error))
  return data?.body || ''
}
export async function saveCardMemo(userId, publicationId, body) {
  requireClient()
  const trimmed = body.trim()
  const request = trimmed ? supabase.from('nitoron_card_memos').upsert({ user_id: userId, publication_id: publicationId, body: trimmed }, { onConflict: 'user_id,publication_id' })
    : supabase.from('nitoron_card_memos').delete().eq('user_id', userId).eq('publication_id', publicationId)
  const { error } = await request
  if (error) throw new Error(['PGRST205', '42P01'].includes(error.code) ? message(error) : 'メモを保存できませんでした。再試行してください。')
  return trimmed
}
export async function listReplies(publicationId) {
  requireClient()
  const { data, error } = await supabase.from('nitoron_feedback_replies').select('*').eq('publication_id', publicationId).order('created_at').order('id').limit(500)
  if (error) throw new Error(message(error))
  return data
}
export async function postReply(publicationId, feedbackId, session, { author, body }) {
  requireClient()
  if (!session?.user || session.user.is_anonymous || !session.user.email_confirmed_at) throw new Error('メールを確認してから返信してください。')
  const { error } = await supabase.from('nitoron_feedback_replies').insert({ publication_id: publicationId, feedback_id: feedbackId, user_id: session.user.id, author: author.trim(), body: body.trim() }).select('id').single()
  if (error) throw new Error(error.code === 'P0001' ? '少し間隔をあけて投稿してください。' : message(error))
}
export async function deleteReply(id) {
  const { error } = await supabase.from('nitoron_feedback_replies').delete().eq('id', id)
  if (error) throw new Error('返信を削除できませんでした。')
}
export async function listResolutions(publicationId) {
  const { data, error } = await supabase.from('nitoron_feedback_resolutions').select('*').eq('publication_id', publicationId)
  if (error) throw new Error(message(error))
  return data
}
export async function setResolution(publicationId, feedbackId, session, status) {
  const { error } = await supabase.from('nitoron_feedback_resolutions').upsert({ publication_id: publicationId, feedback_id: feedbackId, user_id: session.user.id, status }).select('feedback_id').single()
  if (error) throw new Error('対応状況を更新できませんでした。')
}
