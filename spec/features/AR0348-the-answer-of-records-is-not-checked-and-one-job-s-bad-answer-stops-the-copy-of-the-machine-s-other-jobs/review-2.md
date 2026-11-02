# AR0348 - Review 2

- Job: 2026-11-02-review-59425c8e
- Branch: arthur/2026-11-02-worker-33f91ff1
- Commit reviewed: 9974806edb34fcf82e9878c3e096a3a16d5827b6
- Verdict: PASS

## Final message

The merge kept both sides, and `npm run check` and `npm test` pass. The branch can merge.

## Findings
None.

**Merge `9974806e`** (its parents are `488d77a5` and main's `36931316`):
- **Main's side is all there.** Compared with `36931316`, the full range changes only the branch's 4 files (`machine-sync.ts`, `machine.test.ts`, `spawn.md`, `test/structure.test.ts`). None of the 27 files main brought in were dropped or changed.
- **The branch's side is all there.** Between `488d77a5` and the merge, the branch's files differ only by:
  - main's own additions to `packages/core/test/machine.test.ts`: the `TestContext` import, `plantAfterCheck` and the `protocol.ext.allow` test from AR0392;
  - the conflict in `test/structure.test.ts`, settled as `core: 7092`, which is main's 7069 plus the branch's 23 (AR-D453).
- **The fix itself is unchanged since `488d77a5`.** `machine-sync.ts`, `spawn.md` and the branch's AR0348 test are identical to the version that already passed review.

## Notes
- (minor) `488d77a5`: the commit subject says "core line budget 7079". The merge brings that to 7092, so the subject no longer matches the tree.

## Checks
- `npm run check && npm test`, run once in this checkout with an 1800 s timeout:
  - `tsc` passed.
  - Tests: 1492 in all, 1428 passed, 0 failed, 0 cancelled, 64 skipped. The run took 423 s.
- No timing test failed, so I did not run `limits.test.ts` on its own.
- I did not run mutate again, as you asked me to keep this review short.

PASS