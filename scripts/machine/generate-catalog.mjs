import {writeFile} from 'node:fs/promises';
import {createSKP} from '../../vendor/parts-lab/dist/skp-model.js';
import {PARTS} from '../../vendor/parts-lab/dist/skp-parts.js';
import {createCatalog} from '../../vendor/parts-lab/dist/assembly-tree.js';

const model = createSKP();
const catalog = createCatalog(PARTS, model.details, 'SKP-101W');
const nodes = [...catalog.nodes.values()].map(({id,name,kind,parent,children}) => ({id,name,kind,parent,children}));
const output = `// Generated from the pinned source. Do not renumber IDs.\n` +
  `export const SOURCE_COMMIT = 'daf7afab12020d303738c089dbfcf5208132487b';\n` +
  `export const MACHINE_ID = 'skp-101w';\n` +
  `export const MODEL_VERSION = 'skp-101w@daf7afab';\n` +
  `export const ROOT_PART_ID = 'machine';\n` +
  `export const MACHINE_NAME = 'SKP-101W';\n` +
  `export const NODES = Object.freeze(${JSON.stringify(nodes,null,2)}.map(n => Object.freeze({...n, children:Object.freeze(n.children)})));\n` +
  `const index = new Map(NODES.map(n => [n.id,n]));\n` +
  `export function resolveMachineRef(ref) {\n` +
  `  if (ref == null) return {status:'unselected', node:null};\n` +
  `  if (typeof ref !== 'object' || Array.isArray(ref)) return {status:'invalid', node:null};\n` +
  `  if (ref.machineId !== MACHINE_ID) return {status:'unknown-machine', node:null};\n` +
  `  if (ref.modelVersion !== MODEL_VERSION) return {status:'unknown-version', node:null};\n` +
  `  if (ref.partId === '') return {status:'unselected', node:null};\n` +
  `  if (typeof ref.partId !== 'string') return {status:'invalid', node:null};\n` +
  `  const node = index.get(ref.partId);\n` +
  `  return node ? {status:node.id === ROOT_PART_ID ? 'whole' : 'resolved', node} : {status:'unknown-part', node:null};\n` +
  `}\n`;
await writeFile(new URL('../../src/machine/catalog.js', import.meta.url), output);
console.log('Generated', nodes.length, 'nodes; source daf7afab; model skp-101w@daf7afab.');
