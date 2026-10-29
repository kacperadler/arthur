# AR0526 - Outcome

- Merged: 2026-10-29, `405e01ba`
- Branch: arthur/2026-10-29-worker-4242e88a
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $2.27, reviews $1.48; review rounds 2

## What went in

- `packages/core/src/machine-sync.ts`: each sweep copies a remote job's log only up to its last line break and keeps where the held line starts, so a value split by two copies arrives whole and is named; the rest comes when the run there ended or a 256 KiB cut holds no line break.
- `packages/core/test/machine.test.ts`: a value cut between copies, at the 256 KiB cut, on the first copy and after the log there was rewritten shorter, each reaches the local log only as its variable's name.
- `packages/core/docs/config.md`, `packages/core/docs/commands/spawn.md`: the narrower gap left, and how the copy works.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1211/1279 passed.

## Left open

- Deferred (client summary): F1. A value cut inside a remote log line longer than 256 KiB is still named in neither piece
- Deferred (client summary): F2. Invalid UTF-8 in a held line makes the next copy start a few bytes early
- Deferred (client summary): F3. A shell value holding a line break can still be cut between copies
