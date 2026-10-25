# AR0358 - Outcome

- Merged: 2026-10-25, `6da5807e`
- Branch: arthur/2026-10-25-worker-58e611f1
- Reviews: review-1.md PASS
- Cost: worker $1.12, reviews n/a; review rounds 1

## What went in

- `packages/delivery/src/delivery-options.ts`: the always-review list also holds every `package.json`, the npm, yarn, pnpm and bun lockfiles, `.npmrc`, `.nvmrc`, `.githooks/**` and `.husky/**`, so a change to what the merge and each spawn run is always reviewed; `--auto` and autopilot refuse them too.
- `packages/delivery/docs/commands/review-needed.md`, `arthur.config.example.ts`: name the entries and the `--auto`/autopilot tradeoff.
- `packages/delivery/test/review-needed.test.ts`, `auto-merge.test.ts`: a row per file, near-misses that must not match, a held lockfile for `--auto`.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1120/1120 passed.

## Left open

- Findings: AR0432 (F1, approved under AR-D31); F2, F3 dropped.
