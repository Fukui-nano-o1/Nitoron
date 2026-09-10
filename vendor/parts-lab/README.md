# Agricultural machine / PARTS LAB

## SKP-101W addition, 2026-09-09

Default model: Kubota SKP-101W walk-behind automatic vegetable transplanter.
`?model=tractor` retains the original generic tractor and its original guides.
The new model contains 33 independently selectable component groups. An original
procedural model uses the W product photograph, the shared operator's manual and
published overall dimensions; it is not a manufacturer CAD model.

Published envelope: 2200 x 1350 x 1350 mm. The overall generated envelope is scaled
to those values. Individual dimensions, hidden mechanisms, manufacturing fits,
service disassembly sequence, and the user's year/serial applicability are not
verified. Shared operator's-manual illustrations explicitly say SKP-101, so they
are not treated as W-specific engineering drawings. The W photograph informs the
wider running gear and higher spare-tray arrangement. One planting cup is modeled:
the W plants one row per pass, with two rows produced by a round trip.

Data and page references: `dist/skp-parts.js`. Geometry: `dist/skp-model.js` and
`dist/skp-geometry.js`. Export: `node scripts/export-model.mjs skp` creates
`dist/skp-101w.glb` with 33 assembly nodes, 214 internal nodes (including nested
groups and illustrative fasteners), and separate assembly/internal-part animations.

The SKP flow covers four symptoms using linked inspection locations, original
short paraphrases, and explicit self-reported observations (yes / not seen /
unconfirmed). Its report is not a confirmed diagnosis. Records and photos remain
in current page memory; the user can explicitly copy the text report. Clipboard
failure falls back to a text download. Photos are local references and are not
transmitted, attached to the text report, or automatically analyzed.

Primary references, accessed 2026-09-09:

- https://agriculture.kubota.co.jp/product/vegetable_equipment/transplant-SKP-101/02.html
- https://agriculture.kubota.co.jp/img_sys/catalog/7502001503.pdf (created September 2024)
- https://agriculture.kubota.co.jp/img_sys/specifications/6a029e7ae94f2625c9bf438698c23fce/7-50-2-0015_spec.pdf
- https://agriculture.kubota.co.jp/after-support/manual/notice.html?hash=95e6834d0a3d99e9ea8811855ae9229d
- https://agriculture.kubota.co.jp/after-support/manual/download.html?hash=95e6834d0a3d99e9ea8811855ae9229d

Manual code PH136-9151-5, 115 PDF pages. Printed page n maps to PDF page n+18
for its main body. Verified selections: component views p.3-5, inspection safety
p.53, symptom tables p.54/56, cleaning p.62, soil-removal rubber p.85, pickup claws
p.86. The common template's 2017 date is not asserted as the manual's revision
date. Reference PDF/image bytes are not redistributed in the Site or repository.

The product differentiation hypothesis is shorter verified troubleshooting time
and reusable records of symptom/conditions/action/outcome. This prototype only
implements visual navigation, references and observation capture. It does not
claim to outperform the manufacturer documentation, determine failure rates,
identify parts from photos or verify repair outcomes.

## Hierarchical explorer, 2026-09-09

Both machine choices now use machine → system → assembly navigation. A tap selects
only the next child in the current scope. Group/assembly selection pulses red
slowly twice and stays red; internal elements use steady red. Reduced-motion
preferences disable the pulses. “Selected” labels distinguish selection from
fault diagnosis. Breadcrumbs and a back control restore the enclosing assembly.

SKP has 4 systems, 33 assemblies, and 214 independently selectable internal nodes
across 22 assemblies. These include nested groups and illustrative fasteners;
the count is not an OEM part count. The deepest path has six levels, including
machine and system. Wheel fastening sets can be opened into a bolt and washer;
linkage, control levers, mounts and intake also contain smaller groups.
Other assemblies explicitly indicate that their internal parts are not modeled.
Fasteners are schematic groups: these do not establish actual bolt/pin counts,
part numbers or service applicability. Internal element geometry, names and
separation directions remain schematic; some supported elements are themselves
subassemblies, not individual orderable components.

Per-selection condition/symptom lists link six documented conditions to the
manual and relevant 3D locations. Repeated symptoms retain all related conditions.
Individual elements show the parent assembly's information with that distinction
visible. Empty entries say that no condition is registered. No frequency or
confirmed diagnosis is fabricated. Added power-loss inspection content uses
operator-manual p.74; it is not a complete engine diagnosis.

Interaction references, official pages checked 2026-09-09:
- https://partful.io/blog/how-to-build-an-automated-3d-parts-catalog-from-cad-files
- https://www.cortona3d.com/en/rapidcatalog
- https://demo.cortona3d.com/
- https://www.ifixit.com/Device/iPhone

The interaction principles inform original code and geometry. No competitor
source, branding, CAD files or reference PDF bytes are redistributed.

Validation: `node scripts/check-assemblies.mjs` checks both models' hierarchy,
mesh-to-selection levels, internal expansion, return/guide reassembly and all
condition references. The exporter checks geometry, envelope and GLB structure.
Static checks cover HTML IDs, local assets/imports and JavaScript syntax.
No browser interaction or visual QA has been performed in this update.

## Exterior and inspection controls refinement, 2026-09-09

The bonnet uses a smooth swept surface, with cross-sections interpolated from the
catalog exterior. Tires have a curved cross-section, and wheel rims use a dished
profile. Lamp, fuel tank, starter, covers and control grips have rounded forms.
The example seedling tray is hidden in the default view to match the empty machine
in the product photograph; selecting that tray or using a guide reveals it.
These changes approximate the visible exterior. Catalog photos do not establish
unseen surfaces, exact component dimensions or a complete removable-part list.
Display splits of bonnet surfaces are explicitly labeled as display-only splits.

Camera rotation, pan and zoom sensitivity are reduced. One finger / left mouse
drag rotates, or pans when “移動する” is enabled. Two fingers pan and zoom. Selected
parts can become the orbit center with “この部品を回転中心に”. Direction presets
include front, rear, both sides, top and underside. The orbit allows the lower
hemisphere, the floor is hidden below the machine, and small parts allow close
inspection. Resizing no longer recenters the camera; manually moving the camera
also prevents the explosion slider from recentering it.

`node scripts/check-camera.mjs` exercises the vendored OrbitControls math without
a browser: underside access, movable target, gesture mappings and close distance.
The exported GLB contains 259 meshes and 231,948 triangles. Subgroup translations
and fastener separations illustrate hierarchy, not a verified service sequence.
RoundedBoxGeometry is Three.js r180, MIT, retrieved from
https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/geometries/RoundedBoxGeometry.js
with its import adjusted to the local vendored module.

## Original generic tractor

Original procedural 3D schematic of an open-station, four-wheel-drive tractor.
Built 2026-09-09. No manufacturer affiliation or dimensional accuracy claim.

The static website lives in `dist/`. It contains 26 named, separately selectable
assemblies, an animated exploded view, shell transparency, individual isolation,
touch orbit/zoom, three symptom-to-inspection demonstrations, and a local-only
photo reference input. Images are neither transmitted nor automatically diagnosed.

`tractor-model.glb` preserves the 26 component nodes and contains an assembly /
explosion animation. It is a schematic, not an engineering or service CAD model.
No numerical failure rate, repair torque, actual part number, or machine-specific
replacement interval has been inferred.

Maintenance references are linked next to the relevant content and recorded in
`dist/parts.js`. Sources are Kubota's official maintenance pages, accessed
2026-09-09. Site publication/update dates were not confirmed. A list of inspection
points is not evidence of a model's failure frequency.

To target a real machine, collect manufacturer, model, year/serial applicability,
exterior views, underhood photos, illustrated parts list and authorized service
documentation. Map part IDs to the applicable BOM before introducing real repair
instructions or any image-assisted fault hypotheses.

Third-party rendering library: Three.js r180, MIT; license in `dist/vendor/`.
Static sources are authored directly; no build or runtime backend is required.
