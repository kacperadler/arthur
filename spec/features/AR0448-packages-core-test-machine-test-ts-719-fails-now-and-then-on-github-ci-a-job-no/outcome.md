# AR0448 - Outcome

- Merged: 2026-10-26, `72d581d0`
- Branch: arthur/2026-10-26-worker-a025cb83
- Reviews: review-1.md PASS
- Cost: worker $0.59, reviews n/a; review rounds 1

## What went in

- `packages/core/test/machine.test.ts`: the test at :719 waits for both `job` and `held` to read `ended` on the machine before its last sweep; `held`'s run there could end between the two final sweeps and be copied once more by design (`followed()` in `machine-sync.ts`), which gave `18 !== 16`. No source file changed.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1159/1165 passed.

## Left open

- F1: dropped under AR-D53 (see findings.md).
