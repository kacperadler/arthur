# AR0354 - Review 1

- Job: 2026-10-26-review-3a4c3b1f
- Branch: arthur/2026-10-26-worker-f7deae1c
- Commit reviewed: eb023b193e83e2ba01d38377234afdf0317db76a
- Verdict: PASS

## Final message

The branch does what the ticket asks: a job's shell can no longer clear the mark that the refusals check. I found nothing that blocks the merge.

**Findings:** none blocking.
- The worker's change to the ticket's wording is the home check: `insideJob(home, cgroup?, env?)` instead of `insideJob()`. The ticket's 2026-10-26 Decision accepts it ("AR0354 home check accepted under AR-D31; F1 settled as a ticket at merge"), so it is not a departure.
- The gap it leaves is recorded. A job can write its own config with a home of its own and act as that home's coordinator. That is in the ticket's `findings.md` as F1 with `Status: open`, which the merge settles, and in `docs/deploy.md` under "Threat model".
- No refusal reads `ARTHUR_JOB` any more: a search of `packages/*/src` finds it only in the job's own extensions (`steer.ts`, `worktree-guard.ts`, `checks-extension.ts`), in `wrapper.ts` that sets it, and in the fallback in `inside-job.ts:12`.

**Non-blocking notes:**
- **`packages/develop/src/plugin-new.ts:53`:** in a job run without systemd, the worktree is now read from `<home>/jobs/<basename(ARTHUR_JOB)>/worktree` instead of the record `ARTHUR_JOB` names. If `ARTHUR_JOB` names a record outside the config's home, `readFileSync` throws an `ENOENT` error instead of printing the refusal. The command still fails with nothing written; only the message gets worse.
- **Tests that only run inside a job:** the new tests for each refusal with `ARTHUR_JOB` cleared skip outside a job's scope. On CI or the owner's machine, a wrong home passed by a refusal would go unnoticed; here, inside a scope, every such mutation was caught (below).
- **`test/structure.test.ts:681`:** the comment says "orchestration 3 (2340, …)", but the budget is 2396 + 3 = 2399. The 2340 looks stale.
- **`scope.test.ts:84`:** the new assertion needs a systemd user manager. I believe it skipped in my run, as it did for the worker, but I did not check that file's output on its own.
- The scope regex is copied into six test files. That matches the styleguide's preference for duplicating a short function over a shared helper.

**Bypass probes, from inside this review job's own scope (`arthur-job-2026-10-26-review-3a4c3b1f.scope`):**
- **Clearing the variable:** in `/home/kacper/arthur`, `env -u ARTHUR_JOB node <worktree>/packages/core/src/cli.ts send` printed `arthur send: refused inside a job 2026-10-26-review-3a4c3b1f: …` and exited 1. The scope works as the mark end to end.
- **Leaving the scope:** `mkdir` of a child cgroup inside the scope, to move the process out of it, got `Permission denied`. The scope folder belongs to the user, so this holds only because the sandbox blocks it. The worker reports the same for writing into another cgroup's `cgroup.procs`.
- **Another spelling of the real home:** that cannot get through, because the check asks whether `<home>/jobs/<id>` exists on disk. Only a home that really lacks the record gets through, which is the accepted F1.

**Checks run:**
- `npm ci`: 22 packages added.
- `npm run check` (tsc): exit 0.
- `npm test`: 1144 tests, 1086 pass, 0 fail, 0 cancelled, 58 skipped.
- The 7 changed test files besides `scope.test.ts`: 126 tests, 126 pass, 0 skipped. All 7 tests for a job's scope with `ARTHUR_JOB` cleared really ran here.
- Each mutation below made at least one test fail (`ℹ fail 1`):
  - in `inside-job.ts`:
    - the home check dropped;
    - the `ARTHUR_JOB` fallback dropped;
    - the scope matched on any line (`m` flag);
    - the `$` anchor dropped.
  - the home wiring replaced in each refusal:
    - `cli.ts` and `remote-job.ts` given `undefined`;
    - `decision-commands.ts`, `schedule-command.ts`, `youtrack-command.ts` and `github-ci.ts` given `host.folder` instead of its `dirname`;
    - `plugin-new.ts` given `undefined`.
- All mutations were restored with `git checkout --`; `git status --short` is clean.

PASS