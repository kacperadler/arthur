# AR0109 - Review 1

- Job: 2026-10-17-review-ar0109-favicon-cr-f6357440
- Branch: h/2026-10-17-ar0109-favicon-crop-79f79533
- Commit reviewed: 10f1d6cc530071da5395c581bebf6e8b5b2f484d
- Verdict: PASS

## Final message

Worktree clean, nothing left behind.

**Findings:** none that block merge.

**Notes (non-blocking):**
- `site/README.md` edit is outside the ticket's explicit "In" scope list, but it's a one-line correction to doc prose describing the exact `generate.ts` fallback behavior the ticket changed (`arthur-favicon.svg` (else `.png`)` → `arthur-favicon.png`). Leaving it stale would mislead; the ticket's "Out: the README" more plausibly refers to the root `README.md` (unrelated, untouched). Not a scope violation worth failing.
- Center pixel of the 128px favicon reads near-white (likely a hair highlight in the source badge, visually confirmed in the rendered thumbnail) — cosmetic, not a defect.

**Checks run:**
- `git show main:spec/features/AR0109.../ticket.md` — read ticket; diff matches its Done-means and formula (ring `#e0a526`, fill `#19233f`, scale `2.1s`, offsets `-0.55s`/`-0.16s`, top rim hidden).
- Decoded `docs/logo/arthur-favicon.png` with a minimal Node PNG decoder (no PIL/ImageMagick available): 128×128 RGBA, all four corners alpha=0 (transparent), top-center ring pixel `(224,165,38)` = exact `#e0a526` match, ring height 5px (matches `max(1, floor(128/24))=5`).
- Viewed `favicon-128.png`, `favicon-32.png`, `favicon-16.png` from the job folder visually: head/shoulders read clearly at 32px, blurry-but-recognizable at 16px, matches `approved-crop.png` reference layout (gold ring, navy fill, code glyphs).
- Root: `npm ci`, `npm run check` (tsc, clean), `npm test` → 357/357 pass.
- `site/`: `npm ci`, `npm test` → 25/25 pass, including new SVG-leftover-fallback test.
- Mutation: reverted `generate.ts`'s icon lookup to the old SVG-first logic → 24 pass/1 fail, matching worker's claimed repro exactly; restored, `git status` clean.
- `site/npm run build` → "Complete!"; `dist/index.html` has `<link rel="shortcut icon" href="/arthur/favicon.png" type="image/png"/>`; `cmp public/favicon.png docs/logo/arthur-favicon.png` confirms identical bytes.
- `grep` repo for `arthur-favicon.svg`/`.png` references: only historical `findings.md`/`outcome.md`/ticket files from past AR0105/106/108 jobs still name the old SVG (records of past work, correctly left alone); no live code/doc path still depends on it.

PASS
