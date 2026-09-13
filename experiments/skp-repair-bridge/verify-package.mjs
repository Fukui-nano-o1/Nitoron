import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = new URL('./', import.meta.url);
const { files } = JSON.parse(await readFile(new URL('SHA256.json', root), 'utf8'));
assert.ok(files && typeof files === 'object' && !Array.isArray(files));
for (const [name, expected] of Object.entries(files)) {
  assert.ok(!name.startsWith('/') && !name.includes('\\') && !name.split('/').includes('..') && !name.includes('\0'), 'Unsafe manifest path');
  const actual = createHash('sha256').update(await readFile(new URL(name, root))).digest('hex');
  assert.equal(actual, expected, name);
}
async function walk(url, prefix = '') {
  const result = [];
  for (const entry of await readdir(url, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Unexpected symbolic link: ' + prefix + entry.name);
    if (entry.isDirectory()) result.push(...await walk(new URL(entry.name + '/', url), prefix + entry.name + '/'));
    else if (entry.isFile()) result.push(prefix + entry.name);
  }
  return result;
}
const actualFiles = (await walk(root)).filter(name => name !== 'SHA256.json').sort();
assert.deepEqual(actualFiles, Object.keys(files).sort(), 'Unexpected or missing package files');
console.log(JSON.stringify({ verifiedFiles: actualFiles.length, package: 'Nitoron-SKP-Repair-Bridge-2026-09-13' }));
