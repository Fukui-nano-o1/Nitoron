# PC752N: replaceable part geometry / 2026-09-11

Codex candidate for Claude Code. Independent evolution of the dimension-box prototype in `experiments/pc752n-dimension-boxes/`, based on Nitoron main `c7faa3bbaa4338fd6ee9305bc637b9d0c44e8e5b`. See `HANDOFF.md` for integration and fixed acceptance criteria.

**Purpose:** replace a part's geometry while preserving its logical identity, assembly transforms, display-guide steps, selected box, camera, exploded positions and cumulative transparency. Inspired by the publicly described Cadasio workflow; no proprietary source or assets copied. This is NOT a Cadasio CAD importer or repair procedure.

## Run

- Node 22+: `npm test` (the original model checks plus update tests).
- `npm run build` creates `PC752N-exterior-viewer.html`. Open in a modern browser, or serve from a local HTTP server if the phone does not execute saved HTML.
- `npm run check:browser` runs original and new Playwright checks. Playwright or playwright-core and Chromium must already be available. Optional `ATLAS_CHROMIUM_PATH` selects an installed executable. `NODE_PATH` may locate an existing installation. No runtime CDN/API dependencies.
- `node generate-fixture.mjs` deterministically regenerates `fixtures/cowling-revision.json`.

## Use

The existing two dimensional boxes remain. Tap a group, then a component; double-tap a box or press its explode button. Transparency progresses exterior → cables → engine → reset. Five display-guide steps are independently defined; they are viewing aids, not manufacturer disassembly instructions.

Expand **検証用：部品モデルの更新** below the boxes. Select an individual part and export it, or import `fixtures/cowling-revision.json`. The fixture doubles sampling of the SAME assumed orange-cowling surface (126 → 246 vertices); it does not improve factual accuracy. Import updates both boxes and offers one-step undo for the selected part. File contents cannot change hierarchy, transforms, materials or display steps.

**Updates live only in this page session.** Closing/reloading restores the baseline. Export a part to keep its geometry and load it into the original baseline after reload. UI exports target `exterior-v1`; the programmatic `exportPart(id)` defaults to the current revision for consecutive editing, or accepts `{fromBaseline:true}` for baseline replay. This panel is a developer verification tool; end users of the eventual model-number-only product will not be asked to edit geometry files.

## Separation of concerns

| Module | Responsibility |
|---|---|
| `src/model.mjs` | Original assumed shape, unchanged; six groups, 174 meshes |
| `src/assembly.mjs` | Stable part slots, original local transforms, revisions, one-step undo and display displacement vectors |
| `src/presentation.mjs` | Five view steps and cumulative layer classification, independent of geometry |
| `src/part-package.mjs` | Bounded local JSON interchange and validation |
| `src/app.mjs` | Existing viewer plus atomic geometry refresh preserving both view states |

IDs use `pc752n/<group>/<name>/<occurrence>`; old `element-xxx` aliases resolve to these baseline slots. Import never regenerates IDs or reorders parts. When later changing the factory or importing a different CAD assembly, preserve existing slots and explicitly map new source parts. Arbitrary CAD reorder matching is NOT implemented. The 174 mesh slots are display objects, not a verified manufacturer BOM.

## Local part interchange, schemaVersion 1

```json
{
  "schemaVersion": 1,
  "machine": {"maker":"Kubota","model":"PC752N","variant":"single-crawler-standard-rotary"},
  "partId": "pc752n/engine/orange-cowling/001",
  "fromRevision": "exterior-v1",
  "revision": "a-new-part-revision",
  "units": "mm",
  "frame": "part-local-mm-v1",
  "geometry": {"positions": [], "indices": []},
  "evidence": {"basis":"photo-estimate","sourceRefs":["S3"],"note":"Describe the origin and remaining uncertainty"}
}
```

Empty geometry above is schema illustration, not a valid mesh. Export provides valid coordinates. Positions are xyz in the ORIGINAL part-local frame before original translation/rotation/scale, not centered to a new box; indices are indexed triangles. No automatic unit conversion, fitting or recentering. The exported shape preserves its original assembled placement under the unchanged transform.

Limits: file 8 MiB; 100,000 vertices; 600,000 triangle indices; finite coordinates ≤100,000 mm absolute; valid indices and at least one nondegenerate triangle. Wrong model/variant/unit/frame, unknown ID, stale revision, extra keys and invalid data reject without updating current or undo geometry. This is a renderable mesh check, not watertightness, collision, material or engineering validation.

The whole assembled bounding box must keep every baseline min/max within 0.01 mm; the rubber band's known width must remain 110 mm within 0.01 mm. No shape is scaled to make a test pass. These are numerical consistency gates, **not real-world accuracy tolerances**. If future verified CAD proves baseline placement or dimensions need changing, use a separately reviewed assembly revision; this geometry-only importer intentionally rejects that change.

Evidence declarations (`photo-estimate`, `supplier-cad`, `measured`, `verification-fixture`) never self-certify geometry: imported parts are always `pending-review`. `documented3dParts=0`, `automaticReconstruction=false`. S1/S3 references retain their original meanings in `sources.json`.

## Not included

- CAD/STEP/GLB import, source-photo reconstruction, automated model-number generation or improved unseen geometry.
- Durable part registry, cloud persistence, Nitoron production/shared-renderer integration.
- Verified individual dimensions, service order, manufacturer-certified BOM, physical iPhone/GPU tests.

The prototype still uses two WebGL renderers. Original Three.js MIT license and attribution remain. Generated HTML is standalone; source-evidence hyperlinks only navigate on user request.
