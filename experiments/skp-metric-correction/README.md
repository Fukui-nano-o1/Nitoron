# SKP-101W metric correction candidate

Start with `CLAUDE-HANDOFF.md` or the same instruction PDF.

- `SKP-101W-metric-viewer.html`: self-contained 3D comparison, no runtime CDN.
- `baseline/`: four unchanged production source files at main `76fd603…`.
- `src/`: no global scale; metric wheel recipe; measurement and viewer.
- `vendor/`: current production Three.js files, with MIT license.
- `evidence/`: computed measurements and CPU orthographic comparisons.
- `review-only.patch`: source review only, not a production patch.
- `sources.json`: manufacturer source identities and scope limits; no source media redistribution.

```sh
node scripts/verify-package.mjs
npm test
npm run measure
npm run build
# Needs Playwright + Chromium in Claude's verification environment:
npm run check:browser
```

`npm run calibrate` prints the recipe calibration; it never overwrites source.
`node scripts/render-comparison.mjs` regenerates the static SVG comparison.
`python scripts/rasterize-comparison.py` requires PyMuPDF and regenerates PNGs.

The independent Node gates passed. Browser code is delivered for Claude to execute;
Codex's cloud browser rejected local file navigation, so WebGL/UI is not claimed tested.
The PNG/SVG figures are CPU projections, not browser screenshots.

Reference axle locations and tyre widths are unchanged. Candidate front wheels
cross the authored Y=0 plane by 8.94mm; rear wheels clear it by 41.44mm. This is
not a complete mechanical assembly correction and not a 99%-accurate catalogue.
`documented3dParts` remains zero. Do not replace the old production model version.
