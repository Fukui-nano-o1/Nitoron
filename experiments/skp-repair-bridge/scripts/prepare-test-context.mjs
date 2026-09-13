import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
for (const name of fs.readdirSync(path.join(root, 'baseline-payload'))) {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'baseline-payload', name), 'utf8'))
  const content = Buffer.from(data.content), hash = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex')
  if (hash !== data.sha) throw new Error('Baseline Git blob mismatch: ' + data.path)
  const dest = path.join(root, 'baseline', data.path)
  fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, content)
  // Only read-only dependencies needed by the pure transfer tests; not installed into a repository.
  if (data.path !== 'src/Editor.jsx') {
    const target = path.join(root, 'files', data.path)
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content)
  }
}
console.log('Three pinned baseline Git blobs verified; test-only context prepared.')
