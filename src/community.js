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
export async function listPublic({ query = '', region = '', page = 0, filters = EMPTY_FILTERS, sort = 'recent', bookmarkedBy, listId, limit = PAGE_SIZE } = {}) {
  requireClient()
  if (bookmarkedBy === null) return { records: [], count: 0 }
  // listId は名前付きリストの中身（本人の所属行だけがRLSで見える）。公開中の発表だけを返す。
  let request = supabase.from('nitoron_publications').select(listId ? '*,nitoron_list_items!inner(list_id)' : bookmarkedBy ? '*,nitoron_bookmarks!inner(user_id)' : '*', { count: 'exact' }).eq('is_public', true)
  for (const term of normalize(query).split(/\s+/).filter(Boolean)) request = request.ilike('search_text', `%${term.replace(/[\\%_]/g, '\\$&')}%`)
  if (region.trim()) request = request.ilike('region_search', `%${normalize(region).trim().replace(/[\\%_]/g, '\\$&')}%`)
  if (filters.crop.trim()) request = request.ilike('crop_search', `%${normalize(filters.crop).trim().replace(/[\\%_]/g, '\\$&')}%`)
  if (filters.kind !== 'all') request = request.eq('snapshot->meta->>kind', filters.kind)
  if (filters.stage !== 'all') request = request.eq('snapshot->meta->>kind', 'challenge').eq('snapshot->meta->>stage', filters.stage)
  if (filters.from) request = request.gte('snapshot->>date', filters.from)
  if (filters.to) request = request.lte('snapshot->>date', filters.to)
  if (filters.numbers) request = request.eq('has_metrics', true)
  if (listId) request = request.eq('nitoron_list_items.list_id', listId)
  else if (bookmarkedBy) request = request.eq('nitoron_bookmarks.user_id', bookmarkedBy)
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
// 本人の公開版（snapshot つき）。「公開版と異なる変更」の比較に使う。未公開・行なしは null。
export async function getOwnPublication(id, userId) {
  requireClient()
  const { data, error } = await supabase.from('nitoron_publications').select('id,is_public,updated_at,snapshot').eq('id', id).eq('owner_id', userId).maybeSingle()
  if (error) throw new Error(message(error))
  return data
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
// related は「試した結果」に添える本人の実践記録（公開中の本人の発表だけ。DB側でも検証する）。
export async function postFeedback(id, session, { author, kind, section, body, related = null }) {
  requireClient()
  if (!session?.user || session.user.is_anonymous || !session.user.email_confirmed_at) throw new Error('メールアドレスを確認してから投稿してください。')
  if (!author.trim() || !body.trim()) throw new Error('表示名と内容を入力してください。')
  const { error } = await supabase.from('nitoron_feedback').insert({ publication_id: id, user_id: session.user.id, author: author.trim(), kind, section, body: body.trim(), ...(related ? { related_publication_id: related } : {}) }).select('id').single()
  if (error) throw new Error(error.code === 'P0001' ? '投稿間隔をあけて、もう一度お試しください。' : error.code === '42501' ? '実践記録のリンクは、自分の公開中の発表だけに付けられます。' : message(error))
}
// 関連する実践記録のうち、いま公開中のものだけタイトルを返す（公開停止・削除されたものは返らない）。
export async function listRelatedPublications(ids) {
  requireClient()
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return {}
  const { data, error } = await supabase.from('nitoron_publications').select('id,title:snapshot->>title').in('id', unique).eq('is_public', true)
  if (error) throw new Error(message(error))
  return Object.fromEntries(data.map(row => [row.id, String(row.title || '無題')]))
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
  const query = table => supabase.from(table).select('publication_id,created_at,author,body,kind,section').in('publication_id', ids).neq('user_id', userId).gt('created_at', floor).limit(1000)
  const [feedback, replies] = await Promise.all([query('nitoron_feedback'), query('nitoron_feedback_replies')])
  if (feedback.error || replies.error) throw new Error(message(feedback.error || replies.error))
  const counts = {}, first = {}
  const rows = [...feedback.data.map(r => ({ ...r, isReply: false })), ...replies.data.map(r => ({ ...r, isReply: true }))].sort((a, b) => a.created_at.localeCompare(b.created_at))
  for (const row of rows) if (row.created_at > since[row.publication_id]) {
    counts[row.publication_id] = (counts[row.publication_id] || 0) + 1
    // 新着要約：その発表で最初に届いた未読（種類・対象・冒頭）
    if (!first[row.publication_id]) first[row.publication_id] = { author: row.author, kind: row.isReply ? '返信' : row.kind, section: row.section || '', body: String(row.body || '').slice(0, 60), created_at: row.created_at }
  }
  return { counts, first }
}
// 既読は「表示した投稿の最新時刻」まで。表示後に届いた投稿は既読にならない。
export async function markActivitySeen(userId, publicationId, seenAt) {
  requireClient()
  if (!seenAt) return
  const { error } = await supabase.from('nitoron_publication_seen').upsert({ user_id: userId, publication_id: publicationId, seen_at: seenAt }, { onConflict: 'user_id,publication_id' })
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

// ---- 名前付き保存リスト ----
const listMessage = error => ['PGRST205', '42P01', '42883'].includes(error?.code) ? '保存リストの保存先は準備中です。' : '保存リストを更新できませんでした。再試行してください。'
export const LIST_NAME_MAX = 60
export async function listLists(userId) {
  requireClient()
  const { data, error } = await supabase.from('nitoron_lists').select('id,name,is_shared,share_token,created_at,updated_at').eq('owner_id', userId).order('created_at').limit(200)
  if (error) throw new Error(message(error))
  return data
}
export async function listListItems(userId) {
  requireClient()
  const { data, error } = await supabase.from('nitoron_list_items').select('list_id,publication_id,added_at').eq('user_id', userId).order('added_at', { ascending: false }).limit(2000)
  if (error) throw new Error(message(error))
  return data
}
export async function createList(userId, name) {
  requireClient()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('リストの名前を入力してください。')
  if (trimmed.length > LIST_NAME_MAX) throw new Error(`リストの名前は${LIST_NAME_MAX}文字以内にしてください。`)
  const { data, error } = await supabase.from('nitoron_lists').insert({ owner_id: userId, name: trimmed }).select('id,name,is_shared,share_token,created_at,updated_at').single()
  if (error) throw new Error(listMessage(error))
  return data
}
export async function renameList(id, name) {
  requireClient()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('リストの名前を入力してください。')
  if (trimmed.length > LIST_NAME_MAX) throw new Error(`リストの名前は${LIST_NAME_MAX}文字以内にしてください。`)
  const { data, error } = await supabase.from('nitoron_lists').update({ name: trimmed }).eq('id', id).select('id,name,is_shared,share_token,created_at,updated_at').maybeSingle()
  if (error || !data) throw new Error('リストの名前を変更できませんでした。')
  return data
}
// リストの削除は所属行だけを消す（発表・bookmark は残る）。
export async function deleteList(id) {
  requireClient()
  const { data, error } = await supabase.from('nitoron_lists').delete().eq('id', id).select('id').maybeSingle()
  if (error || !data) throw new Error('リストを削除できませんでした。')
}
// 共有ON/OFFとトークン発行はサーバー側関数で一体に行う。ONにするたびに新しいリンクになる。
export async function setListSharing(id, shared) {
  requireClient()
  const { data, error } = await supabase.rpc('nitoron_set_list_sharing', { p_list: id, p_shared: shared })
  if (error) throw new Error(error.code === '42501' ? '自分のリストだけ共有を変更できます。' : listMessage(error))
  return data
}
// bookmark と所属を1トランザクションで追加する。
export async function addToList(listId, publicationId) {
  requireClient()
  const { error } = await supabase.rpc('nitoron_add_to_list', { p_list: listId, p_publication: publicationId })
  if (error) throw new Error(error.code === '42501' ? '自分のリストにだけ追加できます。' : listMessage(error))
}
export async function removeFromList(listId, publicationId) {
  requireClient()
  const { error } = await supabase.from('nitoron_list_items').delete().eq('list_id', listId).eq('publication_id', publicationId)
  if (error) throw new Error(listMessage(error))
}
// 共有リンクの閲覧。null＝無効なリンクか共有停止、items が空＝共有中だが発表なし。取得エラーは例外にする。
export const isShareToken = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '')
export async function getSharedList(token) {
  requireClient()
  if (!isShareToken(token)) return null
  const { data, error } = await supabase.rpc('nitoron_shared_list', { p_token: token })
  if (error) throw new Error(message(error))
  if (!data) return null
  return { id: data.id, name: data.name, updatedAt: data.updated_at, records: (data.items || []).map(unpack) }
}
