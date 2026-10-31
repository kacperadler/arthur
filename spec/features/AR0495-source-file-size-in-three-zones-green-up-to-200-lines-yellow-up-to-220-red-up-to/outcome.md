# AR0495 - Outcome

- Merged: 2026-10-31, `4253ffdb`
- Branch: arthur/2026-10-31-worker-08a2d27a
- Reviews: review-1.md PASS
- Cost: worker $2.08, reviews $0.27; review rounds 1

## What went in

- test/structure.ts: puts each source file in a zone: green up to 200 lines, yellow up to 220 (a line returned in `zones`), red up to 250 only when listed in `red` (unlisted fails), above 250 always fails; a listed path that is not a red source file fails.
- test/structure.test.ts: holds the empty `RED_FILES` list beside `BUDGETS`; the repository test prints each yellow and red line with `t.diagnostic` and checks `RED_FILES` is in name order; tests cover 200, 201, 220, 221 listed and unlisted, 250 listed, 251 listed and unlisted, and a stale entry.
- .agents/arthur/criteria/styleguide.md: "Shape" gives the three zones and `RED_FILES`; the line budget rule is its own bullet.
- .agents/arthur/criteria/review.md: FAILs a source file over 250 lines or an unlisted red file, and a branch that moves a file into yellow or red without saying why; a yellow or red file with an obvious split is a finding.
- spec/features/AR0495-source-file-size-in-three-zones-green-up-to-200-lines-yellow-up-to-220-red-up-to/findings.md: F1, the roadmap's entry 1 still describes the 200-line cap.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1384/1453 passed.

## Left open

- Deferred (client summary): F1. Roadmap entry 1 still says a source file has at most 200 lines
