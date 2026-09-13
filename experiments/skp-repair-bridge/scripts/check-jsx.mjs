import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const supplied = process.env.REPAIR_QA_ESBUILD
if (!supplied) throw new Error('Set REPAIR_QA_ESBUILD to an installed esbuild main.js for this optional source check.')
const esbuild = await import(pathToFileURL(supplied).href)
const results = []
for (const filename of ['Editor.jsx', 'RepairPilot.jsx']) {
  const source = fs.readFileSync(path.join(root, 'files/src', filename), 'utf8')
  const result = await esbuild.transform(source, { loader: 'jsx', format: 'esm', target: 'es2022', sourcefile: filename })
  if (!result.code) throw new Error('Empty transform: ' + filename)
  results.push({ filename, warnings: result.warnings.length, bytes: Buffer.byteLength(result.code) })
}
console.log(JSON.stringify({ check: 'JSX syntax transform, not an application build or browser test', esbuildVersion: esbuild.version, files: results }, null, 2))
