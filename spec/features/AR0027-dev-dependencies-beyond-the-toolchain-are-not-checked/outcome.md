# AR0027 - Outcome

- Merged: 2026-10-16, `226d399`
- Branch: h/2026-10-16-ar0027-dev-dependency-ru-5f3317a6
- Reviews: none
- Cost: worker $0.28, reviews $0.00; review rounds 0

## What went in

- `test/structure.ts`: `checkManifest` refuses any dev dependency other than `typescript` and `@types/node`, in the root or any package `package.json`, naming it.
- `test/structure.test.ts`: a fixture with `vitest` and `sinon` expects exactly those two problems.

## Checks on main

- `npm run check`: passed.
- `npm test`: 13/13 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
