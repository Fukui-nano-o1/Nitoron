export const ATTACHMENT_LIMIT = 12
export const FILE_LIMIT = 20 * 1024 * 1024
export const FILE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'application/pdf': 'pdf' }
const pathPattern = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|avif|pdf)$/i
export function sanitizeAttachments(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  return value.filter(a => a && typeof a === 'object' && pathPattern.test(a.path || '') && FILE_TYPES[a.type] && a.path.toLowerCase().endsWith('.' + FILE_TYPES[a.type]) && Number.isInteger(a.size) && a.size > 0 && a.size <= FILE_LIMIT)
    .filter(a => { if (seen.has(a.path)) return false; seen.add(a.path); return true })
    .slice(0, ATTACHMENT_LIMIT).map(a => ({ path: a.path, name: String(a.name || '添付資料').slice(0, 180), type: a.type, size: a.size, caption: String(a.caption || '').slice(0, 500) }))
}
export function validateFile(file, count = 0) {
  if (count >= ATTACHMENT_LIMIT) throw new Error('添付は1つの記録につき12件までです。')
  if (!FILE_TYPES[file.type]) throw new Error('JPEG・PNG・WebP・AVIFの写真、またはPDFを選んでください。')
  if (!file.size || file.size > FILE_LIMIT) throw new Error('空でない20MB以下のファイルを選んでください。')
  return FILE_TYPES[file.type]
}
export const imageAttachments = record => sanitizeAttachments(record.meta?.attachments).filter(a => a.type.startsWith('image/'))
export const fileSize = size => size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`
