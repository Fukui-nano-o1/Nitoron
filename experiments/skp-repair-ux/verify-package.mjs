import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const digest = (kind, bytes) => crypto.createHash(kind).update(bytes).digest('hex')
const failures = []
const args = process.argv.slice(2)
if (args.length && (args.length !== 2 || args[0] !== '--repo')) {
  console.error('Usage: node verify-package.mjs [--repo /path/to/unchanged-repository]')
  process.exit(2)
}
const safePath = (base, relative) => {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(p => p === '..' || p === '.')) throw new Error(`Unsafe path: ${relative}`)
  return path.join(base, relative)
}
const walk = (base, relative = '') => fs.readdirSync(path.join(base, relative), { withFileTypes: true }).flatMap(entry => {
  const rel = relative ? `${relative}/${entry.name}` : entry.name
  if (entry.isSymbolicLink()) throw new Error(`Symlink is not allowed in the package: ${rel}`)
  return entry.isDirectory() ? walk(base, rel) : [rel]
})
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'SHA256.json'), 'utf8'))
  if (manifest.algorithm !== 'sha256' || !Array.isArray(manifest.files)) throw new Error('Invalid manifest')
  const expected = new Set(['SHA256.json'])
  for (const entry of manifest.files) {
    if (expected.has(entry.path)) throw new Error(`Duplicate manifest path: ${entry.path}`)
    expected.add(entry.path)
    const file = safePath(root, entry.path)
    if (!fs.existsSync(file)) { failures.push(`Missing: ${entry.path}`); continue }
    const bytes = fs.readFileSync(file)
    if (bytes.length !== entry.bytes || digest('sha256', bytes) !== entry.sha256) failures.push(`Package mismatch: ${entry.path}`)
  }
  for (const file of walk(root)) if (!expected.has(file)) failures.push(`Unregistered: ${file}`)
  let checkedBaseline = 0
  if (args.length) {
    const repo = path.resolve(args[1])
    const baseline = JSON.parse(fs.readFileSync(path.join(root, 'baseline-identities.json'), 'utf8'))
    for (const entry of baseline.files) {
      const file = safePath(repo, entry.path)
      if (!fs.existsSync(file)) { failures.push(`Baseline missing: ${entry.path}`); continue }
      const bytes = fs.readFileSync(file)
      const blob = digest('sha1', Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
      if (blob !== entry.gitBlob || bytes.length !== entry.bytes) failures.push(`Baseline mismatch: ${entry.path}`)
      checkedBaseline++
    }
    for (const relative of baseline.addedPaths) if (fs.existsSync(safePath(repo, relative))) failures.push(`New candidate path already exists: ${relative}`)
  }
  if (failures.length) {
    console.error(failures.join('\n'))
    process.exitCode = 1
  } else {
    console.log(JSON.stringify({ packageFiles: manifest.files.length, packageSha256: 'pass', baselineFiles: checkedBaseline, baseline: args.length ? 'pass' : 'not-requested', changesApplied: false }, null, 2))
  }
} catch (error) {
  console.error(error.stack || String(error))
  process.exitCode = 1
}
