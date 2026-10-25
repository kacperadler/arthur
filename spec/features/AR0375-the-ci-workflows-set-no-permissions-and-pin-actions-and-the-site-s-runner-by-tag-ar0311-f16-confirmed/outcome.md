# AR0375 - Outcome

- Merged: 2026-10-25, `7671bc69`
- Branch: arthur/2026-10-25-worker-47922f4a
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $0.80, reviews n/a; review rounds 2

## What went in

- `.github/workflows/ci.yml`, `.github/workflows/site.yml`: a top-level `permissions: contents: read` (deploy keeps its own `pages: write`, `id-token: write`); every action pinned to its commit with the tag as a comment (checkout, setup-node v4.4.0; upload-pages-artifact v5.0.0; deploy-pages v5.0.1); `site.yml`'s jobs run on `ubuntu-24.04`.
- `test/structure.test.ts`: each workflow has a top-level `permissions:` and every `uses:` is pinned to 40 hex.
- `packages/develop/test/plugin-new.test.ts`: its repository copy includes `.github`, so the structure test runs there.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1108/1108 passed.

## Left open

- Tickets from findings: AR0419 (F1, F2); F3 dropped.
