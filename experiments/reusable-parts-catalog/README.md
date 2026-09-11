# Nitoron common parts catalog — 2026-09-11

Independent reusable-component prototype. It complements the earlier `pc752n-updatable-parts` geometry-replacement package; it does not overwrite that package, the PC752N model, or Nitoron main.

## What is implemented

Five procedural families: hex bolt (detailed helical surface or simple shank), hex nut with bore, washer with bore, cable profile with per-instance routing, and a ribbed panel. All example dimensions are development fixtures, not verified manufacturer parts or certified standards. Nut internal threads, chamfers, tolerances, cable conductors and connectors are not implemented.

The design separates:

1. **Recipe**: immutable `key@revision`, family, dimensions in mm, generator version, material appearance, source references/pages/SHA/notes. This is reusable across machine types.
2. **Geometry cache**: geometry created once for identical generator + family + parameters + detail level + routing. Changing a label does not create new geometry. Different materials use separate per-instance materials while sharing geometry.
3. **Installed instance**: unique instance ID, machine ID, translation and normalized quaternion. Every new placement starts `fitStatus=unconfirmed`; using the same shape does not prove compatibility or dimensions of a real machine. Never mutate shared geometry directly.
4. **Machine-specific routing**: cables share diameter/profile and construction code. Their path is supplied separately for each installation. Different paths produce different geometry.
5. **Drawing**: SVG schematic and parameter list generated from the same recipe. Explicitly not to scale, not a manufacturing drawing. Sources can identify an external drawing; its actual file and usage terms must be handled separately. This prototype does not download/store third-party drawings.

## Run

Node 22+: `npm test`, `npm run build`. Open `Nitoron-Reusable-Parts.html` in a modern browser or serve it from a local HTTP server. All runtime Three.js modules are bundled, MIT license retained.

For browser tests: `npm run check:browser` with Playwright (or playwright-core) and Chromium available. `ATLAS_CHROMIUM_PATH` can select an installed browser; `NODE_PATH` can locate an existing runtime dependency. The test does not contact real APIs or manufacturer sites.

## Persistence and versions

The developer UI automatically saves the catalog to localStorage on creation/change. It reports quota/permission failures and offers a JSON export. Import validates the full catalog and merges atomically; conflicting content under the same key/version is rejected, not overwritten. New dimensions need a new key or revision; existing references do not silently upgrade. JSON import into a fresh browser supports handoff. File-URL localStorage behavior is browser-dependent; use export for durable transfer.

Only the **catalog** is persisted by this prototype. Demo placement A/B, their selection, and wiring are not persistent machine records. A/B are synthetic placements, not real identified machinery. There is no cloud registry or automatic machine identification.

## API

```js
const catalog = new Catalog();
const ref = catalog.add(recipe); // existing same revision + same content is idempotent
const pool = new GeometryPool();
const a = pool.acquire(catalog.get(ref), {
  instanceId: 'machineA:bolt:01', machineId: 'machineA',
  position: [0, 20, 10], quaternion: [0, 0, 0, 1], lod: 'detail'
});
const b = pool.acquire(catalog.get(ref), {
  instanceId: 'machineB:bolt:07', machineId: 'machineB',
  position: [5, 10, 20], quaternion: [0, 0, 0, 1], lod: 'overview'
});
// Same LOD and dimensions share BufferGeometry. Different LOD has its own cache entry.
// Cable calls also require route: [[x,y,z], ...].
pool.release(a); pool.release(b); pool.dispose();
```

Cache capacity: 64 unique shape entries, with unused entries evicted before creating another. Live entries are not disposed to make room; an exhausted cache raises an error. Recipes cap at 500 versions and 1 MiB JSON imports. Individual selection changes only that instance's material; geometry remains shared. InstancedMesh draw-call batching is NOT implemented here; the measured saving is fewer geometry-generation calls and shared geometry buffers, not a claimed frame-rate improvement.

## Relationship to previous geometry replacement

Reuse candidates must be matched to a machine's fixed assembly part ID only after identifying actual part type, dimensions, revision and installation. The earlier replacement format is a single mesh in the original part-local frame; a library bolt contains multiple meshes. Automatic conversion/alignment, manufacturer part-number matching and production UI wiring are not implemented. Do not feed a multi-mesh assembly into that importer by dropping meshes or fitting it to a bounding box. This isolated prototype closes the recipe/cache/persistence layer first.

## Evidence and limits

`evidence/` contains actual tests and browser screenshots. `documented3dParts=0` throughout. Details are geometric approximations with explicit parameters, not a claim that hidden machine parts or their dimensions were inferred correctly. Fastener shape does not establish grade, material, pitch standard, tightening torque or interchangeability.

Primary reference for geometry sharing / future batching: https://threejs.org/docs/pages/InstancedMesh.html (checked 2026-09-11). No third-party proprietary model or drawing is included.
