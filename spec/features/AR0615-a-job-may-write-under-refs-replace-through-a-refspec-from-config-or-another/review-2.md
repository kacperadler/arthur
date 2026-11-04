# AR0615 - Review 2

- Job: 2026-11-04-review-47cb3975
- Branch: arthur/2026-11-04-worker-0d510c16
- Commit reviewed: 088acee2a54f9ea0cc7333441da01b45cc4c478f
- Verdict: PASS

## Final message

## Findings

None block the merge. Review 1's finding is fixed.

- Finding 1 (`packages/core/src/git-config.ts:51`, `value === "false"` → `value !== "true"`): I applied that mutation in my checkout. `packages/core/test/git-config.test.ts` then gave pass 6, fail 1: the AR0615 mirror-push test failed. I restored the file with `git checkout -- packages/core/src/git-config.ts` and `git status --short` was empty afterwards. The new `undo` rows (`yes`, `on`, `1`, `2`, `True`) cover the spellings that were missing.
- Every Done means point is met:
  - `checkConfig` sets `core.useReplaceRefs=false` again in the file whose value Git reads last: `.git/config`, the main checkout's `config.worktree`, or the shared config when called from a job's worktree. It writes `--local` when no value is set.
  - `usereplacerefs` is in `ALLOWED`.
  - The mirror-push test checks `status` and `log -1` in the main checkout and in a linked worktree.
  - `docs/deploy.md` and the comment at `git-writes.ts:100-104` now name the setting instead of the open limit.
- The worker gives a reason for the `commit-rules` test change: `checkConfig` now writes the config, and that test checks the config is left untouched. The core budget goes 7158 → 7163 and the structure test passes.
- As you asked, the earlier reviewer's notes (`GIT_NO_REPLACE_OBJECTS` for jobs, grafts, lock contention) are left out of this branch and go to the owner as a new ticket.

## Notes
- (risk) packages/core/src/git-config.ts:37: the setting is only put back when `checkConfig` runs, not passed to the git call. It is not in `pins` as `-c core.useReplaceRefs=false`, so a job that sets it to `true` between the check and Arthur's git call is read for that call. This is the same kind of race AR0392 closed for `PINNED`.
- (minor) packages/core/test/git-config.test.ts:117: the failed-write test uses `chmod 0o555` on `.git`, which does not stop a write when the tests run as root.

## Checks (on 088acee2)
- `npm run check`: tsc passed.
- `npm test`, first run: no failure line; I filtered the output wrongly, so I have no counts from it.
- `npm test`, second run: tests 1536, pass 1471, fail 1, skipped 64. The failure was `Telegram unreachable: the slices wait in the outbox…` in `packages/telegram/test/telegram.test.ts`, a file the diff does not touch.
- `node --import @arthur/core/testing --test packages/telegram/test/telegram.test.ts` alone: 22 tests, pass 22, fail 0. So that failure does not count against the branch.
- Mutation from finding 1, applied by hand: pass 6, fail 1 (caught), then restored.
- `npm run mutate -- --max 4`: 4 mutants, 4 caught, 0 survived, 55 not run.

PASS