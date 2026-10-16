# AR0056 - Review 1

- Job: 2026-10-16-review-ar0056-failed-sys-a2437157
- Branch: h/2026-10-16-ar0056-failed-systemd-ru-146af6ac
- Commit reviewed: 0a003cbda6f3a57173dab7e095d93247453c291d
- Verdict: PASS

## Final message

Matches exactly the worker's claimed file list and diff size (146 insertions, 20 deletions, 6 files). `wrapper.ts`/`stop` untouched, as instructed (AR0017 scope kept separate).

All findings check out. Summary below.

**Findings:** none that block merge.

**Notes (non-blocking):**
- `job-scope.ts:62-70`: tiny TOCTOU window between the loop's `existsSync(pid)` check and the `SIGKILL` on timeout — inherent to any polling design; verified harmless, since `wrapper.ts:75` writes `pid` strictly before spawning the agent (`wrapper.ts:76-78`), so a kill at that point can never orphan a started agent or race a second `job-ended`.
- Spawn is now bounded by up to 10 s instead of returning immediately on the happy path (wrapper's `pid` write is normally near-instant); worker disclosed this honestly, and it's required to let `arthur spawn` print the failure reason before exit — consistent with the ticket's demand that `arthur spawn` prints the reason.
- Touches outside the ticket's named scope (`jobs.ts`, `spawn-command.ts`, `spawn.md`, `spawn.test.ts`) are justified in the worker's final message and are each small, additive, and necessary to surface `failed` to the CLI.

**Checks run (in this worktree, real user systemd manager present):**
- `npm ci`: clean.
- `npm run check` (tsc): clean, no errors.
- `npm test`: 235/235 passed, 0 failed — matches worker's claim exactly, including the 4 new `scope.test.ts` tests and 1 new `spawn.test.ts` test.
- `wc -l packages/core/src/jobs.ts` → 200 (at the cap, passes); total core `src/` = 3492 lines, well under the 4000-line budget.
- Mutation 1 — removed the `exited !== undefined` early-return in `launch`: the three exit-path `scope.test.ts` tests failed (two confirmed failing before the 120 s harness cutoff, consistent with the third timing out the same way). Reverted, `git diff --stat` clean.
- Mutation 2 — changed `SIGKILL`→`SIGCONT` and dropped the `await closed.promise` wait: the 10 s timeout test failed on "the sleep it ran is gone". Reverted; killed the two leftover `sleep 300` processes left by the mutated run.
- Mutation 3 — removed the `failed`-print/exit-1 branch in `spawn-command.ts`: the new CLI test failed (`[0, 'warning: ...']` vs expected `[1, 'failed: systemd-run: ...']`). Reverted, `git diff --stat` clean.
- Confirmed `job-ended` event shape (`id, kind, project, state, reason`) in `job-scope.ts:89` matches `wrapper.ts:190` exactly — no boundary/consistency drift.
- Confirmed worktree/branch survive: `scope.test.ts`'s `endedAtSpawn` and `spawn.test.ts`'s new test both assert the branch and worktree remain after a failed launch.

PASS
