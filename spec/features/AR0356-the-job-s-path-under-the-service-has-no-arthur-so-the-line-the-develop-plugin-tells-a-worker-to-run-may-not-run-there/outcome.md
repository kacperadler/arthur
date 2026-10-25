# AR0356 - Outcome

- Merged: 2026-10-25, `a91c1308`
- Branch: arthur/2026-10-25-worker-1e61e30e
- Reviews: review-1.md PASS
- Cost: worker $0.83, reviews n/a; review rounds 1

## What went in

- `packages/develop/src/plugin-new.ts`: the line a worker is told to run is `cd <checkout> && node_modules/.bin/arthur plugin new …`, and its help hint `node_modules/.bin/arthur plugin --help`, so they run under the service's `PATH`, which has no `node_modules/.bin`.
- `packages/develop/test/plugin-new.test.ts`: runs that line with the service's `PATH` of `docs/setup.md` after checking `arthur` is not on it.
- `packages/develop/docs/commands/plugin.md`: the job example uses the path, with the reason.
- `packages/core/test/worktree-guard.test.ts`: the guard still lets the new line through.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1108/1108 passed.

## Left open

- Tickets from findings: AR0423 (F1); F2 dropped.
