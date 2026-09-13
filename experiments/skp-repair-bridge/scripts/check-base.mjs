import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repository = process.argv[2]
if (!repository) throw new Error('Usage: node scripts/check-base.mjs /absolute/path/to/Nitoron')
for (const name of fs.readdirSync(path.join(root, 'baseline-payload'))) {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'baseline-payload', name), 'utf8'))
  const content = fs.readFileSync(path.join(repository, data.path))
  const hash = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex')
  if (hash !== data.sha) throw new Error('Pinned source differs; do not overwrite: ' + data.path)
}
for (const file of ['src/RepairPilot.jsx', 'src/repair-pilot.mjs']) if (fs.existsSync(path.join(repository, file))) throw new Error('New destination already exists; do not overwrite: ' + file)
console.log('Pinned Editor/catalog/guide source verified; the two new paths are absent. No files changed.')
