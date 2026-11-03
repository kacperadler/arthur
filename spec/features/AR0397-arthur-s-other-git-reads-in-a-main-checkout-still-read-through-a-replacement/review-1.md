# AR0397 - Review 1

- Job: 2026-11-03-review-2f699591
- Branch: arthur/2026-11-03-worker-b6f730fb
- Commit reviewed: f734a760f666c3a756c1ce94869e494e5122316e
- Verdict: PASS

## Final message

## Findings

None. All 11 call sites in AR0384 F2 are now handled:
- **Fixed on this branch (8):** `plans.ts:62`, `plans.ts:92`, `install.ts:21`, `onboarding.ts`, `findings-command.ts:56`, `audit.ts:25`, `retro-due.ts:29`, `restart-guard.ts:18` and `ci-wait.ts:45`, each now with `--no-replace-objects`.
- **Already handled at the base `2f192e40`:** `health-checks.ts:31` already passed `--no-replace-objects` plus the hookless `-c` flags, and `commit-rules.ts` already read the rule file from disk with `readFileSync`, so it has no git call left.

None of the fixed calls touches the index or the working tree. Each reads only commits and trees (`log`, `show -s`, `cat-file`, `rev-parse`, `for-each-ref`, or a diff between two commits), so the ticket's "hookless `-c` flags where the call may run a hook or fsmonitor" doesn't apply. Each package has a test that plants a replacement before the read.

## Notes
- (minor) `test/structure.test.ts:42`: the projects line budget goes from 594 to 595 and no Decision in the ticket gives the reason. The worker says why in its final message: adding the flag pushes the onboarding diff call past 160 characters, so it was split onto two lines. The raise has to show in the merge's `outcome.md`.
- (minor) `packages/core/src/remote-job.ts:40` (outside this range): `cat-file -e <commit>^{commit}` still reads through replacements. The worker judged this harmless, by reasoning only, without running it.

## Checks
- `npm run check`: tsc passed with no errors.
- `npm test` (run twice, the first output was badly filtered): `ℹ tests 1502`, `ℹ pass 1438`, `ℹ fail 0`, `ℹ skipped 64`. This matches the worker's claim. Seven files are yellow, none of them changed by this branch.
- Hand mutation: I removed `--no-replace-objects` from `ci-wait.ts`, `onboarding.ts`, `retro-due.ts` and `findings-command.ts` and ran `node --test --test-name-pattern='AR0397|run that hangs'` on their four test files. Result: `ℹ fail 4`, every test failed. I restored the files with `git checkout -- packages`, and `git status` is clean.
- I did not run `npm run mutate`, because the budget was small.

PASS