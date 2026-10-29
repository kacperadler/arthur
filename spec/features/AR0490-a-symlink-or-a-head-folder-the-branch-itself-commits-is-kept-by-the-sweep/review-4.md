# AR0490 - Review 4

- Job: 2026-10-29-review-e2f24715
- Branch: arthur/2026-10-29-worker-6a44e150
- Commit reviewed: 872b28d02b26bdacb7bd199eee2d08c42b9c4e1d
- Verdict: PASS

## Final message

No blocking findings. Both mutations from review 3 now fail `merge-checks.test.ts`, and the other key behaviors I mutated are caught too. The project's checks pass in this checkout. Commit `872b28d0` changes only the test file, as the worker says.

## Findings

None.

## Notes (not blocking)

- **Review 3's finding is fixed.** The test "a repository a step plants in a folder above an owner's symlink's target, the one right above, two above, or the temporary folder itself…" in `packages/delivery/test/merge-checks.test.ts` has two new plants:
  - `git init $TMPDIR/a` behind the new link `tools/deep -> $TMPDIR/a/b/box`;
  - a second step, `git init $TMPDIR`, which must remove the control link `tools/calm`.

  It also checks with `git rev-parse --show-toplevel` that git finds each planted repository, so the plants test a real attack.
- **Earlier open items are unchanged:** F1 to F6 in `findings.md` are still open. F1, a merge with no step sweeps nothing, still needs a follow-up ticket. Raising the link limit to `< 41` is still not caught by a test; the kernel's ELOOP limit makes that limit unreachable.
- **Comment placement:** `packages/delivery/src/merge-command.ts:135` puts its why-comment at the end of the `stepRunner` line, not on its own line above it. The file is at exactly 200 lines.
- **Line budget:** delivery 1636 → 1686 is covered by AR-D306, AR-D308 and AR-D315 in main's ticket. `merge-sweep.ts` is 157 lines and `merge-checks.ts` 110, both under 200.

## Checks run

- `npm ci`, then `npm run check`, then `npm test`, timeout 1800. The first run's summary filter matched no lines, so I ran `npm test` again on its own and read the summary.
  - `npm run check`: `tsc` clean.
  - `npm test`: 1287 tests, 1225 pass, 0 fail, 62 skipped. This matches the worker's numbers.
  - No test in `limits.test.ts` failed, so I did not run it alone.
- `node --test packages/delivery/test/merge-checks.test.ts` with no change: 21 pass, 0 fail.
- Mutations, each restored with `git checkout --`. `git status --short` was empty at the end. Every one is caught:

| Mutation | Tests run | Result |
|---|---|---|
| `merge-sweep.ts:103` `parents.slice(0, 1).flatMap` (only the folder right above) | `merge-checks.test.ts` | 1 fail (the plants test) |
| `merge-sweep.ts:103` `parents.filter((parent) => parent !== folder)` (skip the write folder itself) | `merge-checks.test.ts` | 1 fail (the plants test) |
| `merge-command.ts`: `stepRunner` moved after `git merge` | `merge.test.ts`, "what the branch itself commits…" | 1 fail |
| `owned`: `tmpdir()` left out of the folders a step writes | `merge-checks.test.ts` | 5 fail |
| `target`: `hops.length < 40` → `< 39` | `merge-checks.test.ts` | 1 fail |
| `linked`: `UNSEEN` for an unreadable target dropped | `merge-checks.test.ts` | 1 fail |
| `linked`: only the end of the chain checked against the write folders, not the links on the way | `merge-checks.test.ts` | 2 fail |
| `repositories`: a `.git` symlink stamped, not passed to `linked` | `merge-checks.test.ts` + `merge.test.ts` | 1 fail |

- I ran my first two mutations in parallel and the second run picked up the first edit by mistake. I ran the "skip the write folder" mutation again on its own; that is the result in the table.

PASS