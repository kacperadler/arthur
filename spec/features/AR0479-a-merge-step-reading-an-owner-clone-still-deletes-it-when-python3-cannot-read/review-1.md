# AR0479 - Review 1

- Job: 2026-10-29-review-ebd6b052
- Branch: arthur/2026-10-29-worker-4bedc8f1
- Commit reviewed: 5343b5ccb2ec18581fc321ec189ba034effc2e54
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0479 asks, all project checks pass, and every mutation I tried on the new behaviour failed at least one test.

## Findings

None.

## Notes (do not block the merge)

- **Different file than the ticket names.** The ticket's Scope names `packages/delivery/src/merge-checks.ts`, but the change is in `packages/delivery/src/merge-sweep.ts`. That is justified: `merge-checks.ts` at the base contains no `python3` or `stamp(` any more, and the worker's message gives this reason.
- **Retry works as asked.** In `merge-sweep.ts:11`, a stamp starting with `python3 failed` is read once more, and only on the read after a step, which is what Done means asks for. If python3 fails on the first look before any step, that is not retried, so every clone `.git` that existed then is still removed. That matches the ticket's wording and is no worse than before the change, but one failed call at that point still costs the owner's clones. It could be a follow-up finding.
- **The marker string cannot be faked.** A successful read always starts with an absolute path (`/`), so it can never begin with `python3 failed`. A step that makes python3 fail on purpose only adds the change time back into the stamp. That makes the check stricter, not looser, so I found no way around it.
- **The danger warning is gone from one line.** In `merge-sweep.ts:14`, the "could not be removed (<why>)" line now gives only the python3 reason. It no longer warns that a git call in a folder that stays would run its config outside any sandbox. The ticket says "instead of", so this follows it, but the owner loses that warning for a folder that stays.
- **Readability.** To stay within delivery's line budget of 1631, `sweep` now packs the retry and the reason choice into two very long lines (11 and 14). This is allowed, but they are hard to read.

## Checks run

- `npm ci` → 24 packages added.
- `npm run check` → exit 0.
- `npm test` → `tests 1263, pass 1201, fail 0, cancelled 0, skipped 62`, exit 0. This matches the worker's numbers.
  - An earlier run that the harness moved to the background showed file-level "Promise resolution is still pending" errors.
  - I reran it with output to a file inside the worktree: exit 0, with the summary above.
- `node --test packages/delivery/test/merge-checks.test.ts test/structure.test.ts` → 30 pass, 0 fail.
- Mutations of `merge-sweep.ts`, each run against `merge-checks.test.ts` and restored with `git checkout`. Every one was caught:

| Mutation | Tests failed |
|---|---|
| Retry removed | 1 |
| Retry done twice (limit moved by one) | 1 |
| Retry never fires | 1 |
| Generic reason always used | 3 |
| `before.has(path)` check dropped | 1 |
| Before side only checked | 2 |
| After side only checked | 1 |
| Marker set back to `""` | 3 |

- Rules checked:
  - `merge-sweep.ts` is 108 lines.
  - No new files, no dependencies, no imports across package boundaries.
  - The tests use temporary folders and a fake python3 on a temporary PATH that is always restored.
  - `merge.md` describes the retry and the new line.
- The worktree was clean after the review.

PASS