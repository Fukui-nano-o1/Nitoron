# Kubota catalog additions and related rows — 2026-09-16

Added 8 product-series cards (NB, SL, NW, AW, ER, KR, SKP, KP), bringing the Kubota catalog to 18 cards. Each has an official product photo, model names, a short overview, and manufacturer source links.

`nitoron-catalog/2` explicitly records `product-overview` coverage. Facts come from product pages. Catalog PDFs were checked for availability; their contents and manual bodies were not audited. No new repair procedure or 3D model is claimed. Version 1 manual-based entries retain their existing rules and output.

Rebuild each card with `node scripts/catalog-to-record.mjs data/catalog/kubota/<series>.json`. IDs are deterministic and photos remain in `data/card-photos.json`; generated records retain the existing app format. No manufacturer PDF or photo binary is stored in served directories.

Related rows use native horizontal scrolling plus previous/next buttons when content overflows. End buttons disable automatically. Focused rows support Left/Right/Home/End. Reduced-motion settings disable smooth programmatic motion.

Validation: catalog tests 9/9; production build succeeds; all 8 images and catalog links return HTTP 200; generated records pass the existing publication validator and model-name search. Database notes and publication snapshots match. Hashes of all pre-existing rows are unchanged.

Browser verification was attempted using the connected browser, but the local preview URL was blocked with `ERR_BLOCKED_BY_CLIENT`. No browser, mobile-device, swipe, or animation pass is claimed for this change.

Changes are restricted to Nitoron catalogs and related-card UI. No email configuration, authorization policy, or Chitose project was changed.
