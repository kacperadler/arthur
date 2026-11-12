# AR0697 - Outcome

- Merged: 2026-11-12, `cdcd7c6b`
- Branch: arthur/2026-11-12-worker-9e102476
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $1.96, reviews $0.96; review rounds 2

## What went in

- `packages/core/src/testing.ts`: at exit, the kit sends SIGKILL to each process other than itself whose working folder or command line lies in its folder, then removes the folder; the header comment says so.
- `packages/core/test/testing.test.ts`: the test that a child's leftover `sleep` (working in its folder) and `node` (naming a file there) are killed at exit. The child itself is not killed, nor are a `sleep` working in, and a `node` naming a file in, a sibling folder of the same TMPDIR. `alive` counts a zombie as dead.
- `test/structure.test.ts`: the `core/testing` line budget goes from 405 to 408 for the exit sweep.
- `docs/plugin-api.md`: the `@arthur/core/testing` section says the kit kills the processes a test left in its folder before it removes the folder.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1715/1786 passed.

## Left open

- Findings: none; no findings.md on this ticket.
