# AR0490 - Review 3

- Job: 2026-10-29-review-5942c9b8
- Branch: arthur/2026-10-29-worker-6a44e150
- Commit reviewed: 1373f81fc79c5b413d3df061e7462a7e4a8fcc5c
- Verdict: FAIL

## Final message

I'm failing this branch on test coverage only; the code itself works. The fix in `linked()` does remove an owner's link when a repository is planted at any depth above its target. But the new test only plants one folder above the target, so two mutations of the new folder walk get through it.

## Findings

1. **`packages/delivery/test/merge-checks.test.ts` (the test "a repository a step plants in a folder above an owner's symlink's target…") never plants more than one level above a target, so most of the walk to the write folder in `merge-sweep.ts:101-103` is untested.** All three plants (`cache` above `cache/box`, `b` above `b/inner`, `h` above `h/s`) sit in the folder directly above. Two mutations of line 103 each leave `merge-checks.test.ts` at 21 pass, 0 fail:
   - `return parents.slice(0, 1).flatMap(…)` checks only the folder directly above.
   - `return parents.filter((parent) => parent !== folder).flatMap(…)` skips the write folder itself, so a planted `/tmp/.git` is missed.

   I showed the real gap with a throwaway script, since removed: an owner link `tools/deep -> $TMPDIR/a/b/box`, then a step `git init $TMPDIR/a`.
   - At the commit: the sweep printed `removed tools/deep, …`.
   - Under the `slice(0, 1)` mutation: no line, the link was kept, and `git -C $TMPDIR/a/b/box rev-parse --show-toplevel` printed `…/writable/a`.

   The behavior is right, but the review criteria count an uncaught mutation of a key behavior as a FAIL. The fix is a plant two or more levels above a target, and one in the write folder itself.

## Notes (not blocking)

- **Folders above each link on the way:** git does not search the folders above a link it went through. I checked: with `h/s -> ../else` and `git init h`, `git rev-parse` in `h/s` says "not a git repository". So the `tools/hp` case removes a link git could not be exploited through. That errs on the safe side and is covered by AR-D314. But the test name ("where git walking up finds it") and the comment above `linked()` say git would find it there, which is not true.
- **`existsSync` instead of `lstat`:** a dangling `.git` symlink that a step plants above a target is recorded as "missing", the same as the owner's state, so it stays. Something written later could make it valid, for example a job writing `/dev/shm/<x>`. Such a job could also plant `.git` directly, so this only delays an attack that is already possible.
- **The line budget:** delivery 1636 → 1686 is covered by AR-D306, AR-D308 and AR-D315 in main's ticket, and `merge-sweep.ts` (157 lines) and `merge-checks.ts` (110 lines) are under 200.
- **Earlier notes still stand:** F1, a merge with no step sweeps nothing, still needs a follow-up ticket. Raising the link limit to `< 41` is still not caught by a test; the kernel refuses a 41st link anyway.

## Checks run

- `npm ci`, `npm run check` and `npm test` in one bash call, timeout 1800: `tsc` clean; 1287 tests, 1225 pass, 0 fail, 62 skipped. This matches what the worker reported. No timing test failed.
- `merge-checks.test.ts` alone at the commit: 21 pass, 0 fail.
- Mutations in `merge-sweep.ts`, each run against `merge-checks.test.ts` and then restored with `git checkout --`:

| Mutation | Tests failing |
|---|---|
| check only `.git` | 1 |
| check only `HEAD` | 1 |
| folders above the end of the chain only | 1 |
| folders above the links on the way only | 1 |
| no folders above at all | 1 |
| `realpathSync(dirname(link))` → `dirname(link)` | 1 |
| check only the folder directly above | **0 (not caught)** |
| leave out the write folder itself | **0 (not caught)** |

- Bypass script, run at the commit and under the `slice(0, 1)` mutation: results as in finding 1. The script and its temporary folder are removed, and `git status --short` is empty.

FAIL