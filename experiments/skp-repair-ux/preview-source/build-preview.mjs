import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
const cwd = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
if (args.length !== 4 || args[0] !== '--repo' || args[2] !== '--out') throw new Error('Usage: node build-preview.mjs --repo /path/to/applied-repository --out /path/to/temporary-output')
const candidateRepo = path.resolve(args[1])
const localOnly = { name: 'preview-local-only', setup(builder) { builder.onResolve({ filter: /^\.\/repo\// }, arg => ({ path: path.join(candidateRepo, arg.path.slice('./repo/'.length)) })); builder.onLoad({ filter: /[/\\]src[/\\]supabase\.js$/ }, () => ({ contents: 'export const supabase=null; export const ensureSession=async()=>null; export const loginRequired=()=>true;', loader: 'js' })) } }
const output = path.resolve(args[3])
fs.mkdirSync(output, { recursive: true })
await build({ entryPoints: [path.join(cwd, 'preview.jsx')], outfile: path.join(output, 'preview.js'), bundle: true, minify: true, format: 'iife', platform: 'browser', target: ['safari16', 'chrome110'], nodePaths: [path.join(candidateRepo, 'node_modules')], plugins: [localOnly], define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"' }, legalComments: 'inline' })
await build({ entryPoints: [path.join(cwd, 'ssr-check.jsx')], outfile: path.join(output, 'ssr-check.mjs'), bundle: true, format: 'esm', platform: 'node', packages: 'external', plugins: [localOnly], define: { 'import.meta.env': '{}' }, loader: { '.css': 'empty' } })
const css = fs.readFileSync(path.join(output, 'preview.css'), 'utf8')
const script = fs.readFileSync(path.join(output, 'preview.js'), 'utf8')
const previewCSS = '.preview-header{padding:20px 24px;display:flex;gap:20px;align-items:center;border-bottom:1px solid #eee}.preview-header>a{font-size:1.5rem;letter-spacing:-1px;font-weight:750;color:#ff385c;text-decoration:none}.preview-header span{font-size:.75rem;color:#717171}.preview-header button{margin-left:auto;font-size:.8rem;text-decoration:underline}.preview-bottom{display:flex;justify-content:space-evenly;gap:18px;position:fixed;bottom:0;left:0;right:0;background:white;border-top:1px solid #ddd;padding:20px 12px;z-index:34}.preview-bottom a{font-size:.9rem;text-decoration:none}.repair-action-panel{bottom:70px}'
const html = '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; connect-src \'none\'; font-src data:; worker-src blob:; base-uri \'none\'"><title>Nitoron 修理 UI 操作プレビュー</title><style>'+css.replace(/<\/style/gi,'<\\/style')+'\n'+previewCSS+'</style></head><body><div id="root"></div><script>'+script.replace(/<\/script/gi,'<\\/script')+'</script></body></html>'
fs.writeFileSync(path.join(output, 'Nitoron-Repair-UX-Preview.html'), html)
console.log('Preview bytes:', Buffer.byteLength(html))
