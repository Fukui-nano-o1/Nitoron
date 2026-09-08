import { supabase } from './supabase.js'
import { validateFile } from './attachment-domain.js'
export const BUCKET = 'nitoron-files'
export async function uploadAttachment(file, recordId, session, count = 0) {
  const extension = validateFile(file, count)
  if (!supabase || !session?.user) throw new Error('写真・資料を添付するにはクラウドに接続してください。')
  const path = `${session.user.id}/${recordId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: '60' })
  if (error) throw new Error('添付できませんでした。接続と保存先の設定を確認して再試行してください。')
  return { path, name: file.name.slice(0, 180), type: file.type, size: file.size, caption: '' }
}
export async function attachmentUrls(paths) {
  if (!paths.length || !supabase) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60)
  if (error) throw new Error('添付資料を読み込めませんでした。')
  return Object.fromEntries((data || []).filter(x => x.signedUrl && !x.error).map(x => [x.path, x.signedUrl]))
}
export async function openAttachment(asset) {
  if (!supabase) throw new Error('クラウドに接続できません。')
  const { data, error } = await supabase.storage.from(BUCKET).download(asset.path)
  if (error) throw new Error('資料を取得できませんでした。公開が停止されている場合もあります。')
  const url = URL.createObjectURL(data), link = document.createElement('a')
  link.href = url; link.download = asset.name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
