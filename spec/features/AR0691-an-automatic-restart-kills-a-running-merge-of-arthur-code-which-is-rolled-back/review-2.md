# AR0691 - Review 2

- Job: 2026-11-11-review-9fba2a5a
- Branch: arthur/2026-11-11-worker-32ad867e
- Commit reviewed: c690279abb7a498f9883b5ee210feaabe6cf6be1
- Verdict: PASS

## Final message

No finding blocks the merge. Review 1's finding is fixed and I confirmed the fix holds. The branch does what AR0691 asks: while `merge.lock` names a live process, no restart happens. That covers a restart that is due, the fresh start's tries and `/restart`, both `arthur merge` and `arthur merge --auto`. A lock left by a dead process holds nothing. The docs say only what the code does. The remaining gap is open finding F1: the lock is released before the push and the prune, so a restart can still end those two steps. The ticket's Scope asks to publish whether a merge runs from `merge.lock` and the pid in it, which is what the branch does.

- **Review 1's finding (`packages/session/src/restart.ts:197`) is fixed.** I applied the same mutation again: `const held = host.jobs.running().length > 0 ? busy(host, false) : "";`. The test at `packages/session/test/restart.test.ts:229` now fails ("waited 20 s for a look at the merges"). I restored the file with `git checkout`.
- **The docs claim no more than the code does.** `session.md:5`, `restart.md:7` and `plugin-api.md:138` now say the hold runs from the merge's first look at main through its `spec:` commit, and does not cover the push or the prune. This matches `merge-command.ts:46-48` and `:65-73`.
- **What I checked in `merging()` (`packages/delivery/src/merge-recovery.ts:51-63`):**
  - A lock that is empty, has text that is not a pid, or names this process without being held by it names no merge. These cases are tested.
  - A lock that is a folder, or a pid that is negative or fractional, also names no merge. I read these from the code and did not run them.
  - A lock written before the merge has written its job name is reported by project only.
  - The one gap I found is the boot id after a reboot, already F3.

## Notes
- (minor) `packages/delivery/src/merge-recovery.ts:52`: `merging()` only looks at projects in `host.board.projects()`. A merge whose project was removed from the config while it ran holds no restart.
- (minor) `packages/session/test/restart.test.ts:240`: under the mutation, the test fails because its `looks` counter times out after 20 seconds, before its `first.messages()` assertion is reached. It catches the mutation, but the failure is slow.
- (minor) `packages/develop/test/scenarios.test.ts:104` (outside the range): an example coordinator reply still says "once no job runs".

## Checks (all on c690279a)
- **`npm run check`:** tsc, no errors.
- **`npm test`:**
  - Full run: 1743 tests, 1677 passed, 2 failed, 64 skipped. Both failures were in `packages/herdr/test/herdr.test.ts` ("before start nothing reaches herdr…", a 20-second wait; "a prune in a process that never started…").
  - The host's load average was 16–22 on 3 cores during the run.
  - Alone, `node --import @arthur/core/testing --test packages/herdr/test/herdr.test.ts` passed 11 of 11. The branch does not touch that file, so per `verify.md` these two failures do not count against it.
  - The structure test passed and listed `packages/session/src/restart.ts` at 216 lines (yellow); the worker said so.
- **`npm run mutate`:**
  - First run: 14 mutants, 10 caught, 4 survived, 11 not run (time).
  - Second run, resumed: 25 mutants, 18 caught, 7 survived, 78 not run (`--max 25`).
  - The 7 survivors are the ones the worker listed: five in `arthur.config.example.ts:220` (hunk reverted, `freshAt` deleted, `"24:00"`, `"22:00"`, `"23:1"`), and two wording hunks (`session-options.ts:34`, `restart.ts:87`). None is in key behavior.
- **Hand mutations** (each restored with `git checkout`; `git status` is clean):
  - The `restart.ts:197` mutation above: caught.
  - `freshAt: "24:00"` in `arthur.config.example.ts`: caught by `session.test.ts`, "arthur.config.example.ts gives session every option of its table…" (1 failed). This confirms the worker's explanation for the config survivors.
- **`npx arthur restart --help`**, with a throwaway config loading orchestration and session (since removed): it prints the new steps 1 and 5 naming the merge.

PASS