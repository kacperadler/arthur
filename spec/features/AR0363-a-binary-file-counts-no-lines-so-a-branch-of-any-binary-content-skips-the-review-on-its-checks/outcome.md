# AR0363 - Outcome

- Merged: 2026-10-25, `36c70b5d`
- Branch: arthur/2026-10-25-worker-3f46ff15
- Reviews: review-1.md PASS
- Cost: worker $0.67, reviews n/a; review rounds 1

## What went in

- `packages/delivery/src/review-needed.ts`: a `git diff --numstat` line with `-` for its counts (a binary file added or replaced) answers `review: changes a binary file <path>`, before the docs-only and size rules, so a binary change is reviewed whatever its size, its checks or its name; the size sum no longer counts `-` as zero. Net zero source lines, within delivery's budget.
- `packages/delivery/docs/commands/review-needed.md`, "The rules": the new rule 5, the rest renumbered.
- `packages/delivery/test/review-needed.test.ts`: `src/shop.wasm` with passing checks is reviewed; a binary `docs/logo.md` beside docs is reviewed, not `no review: all docs`.
- Review PASS (review-1.md). Merged on the owner's standing AR-D11; the rule order (before docs-only) is the coordinator's pick under AR-D11.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1106/1106 passed.

## Left open

- Findings: none; no findings.md on this ticket.

- Findings: F1, F2 dropped (findings.md).
