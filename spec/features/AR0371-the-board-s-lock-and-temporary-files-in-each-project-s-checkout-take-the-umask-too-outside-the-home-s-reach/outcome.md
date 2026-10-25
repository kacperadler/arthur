# AR0371 - Outcome

- Merged: 2026-10-25, `67a0f73c`
- Branch: arthur/2026-10-25-worker-1836619f
- Reviews: review-1.md PASS
- Cost: worker $0.69, reviews n/a; review rounds 1

## What went in

- `packages/core/src/board.ts`: `transientFolder` sets `spec/.board/` (the board's lock and temporary files) to `0700` after creating it, whatever the umask and also when it was `0755` before; `spec/` itself keeps the project's mode.
- `packages/core/test/board.test.ts`: under umask 022, `spec/.board/` is `0700` and `spec/` stays `0755`, for a new folder and an old `0755` one.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1115/1115 passed.

## Left open

- Findings: F1-F3, review notes, dropped (see findings.md).
