# AR0685 - Review 1

- Job: 2026-11-10-review-3874a908
- Branch: arthur/2026-11-10-worker-3ef1c02b
- Commit reviewed: 074c341f21452328394c86dd6c9c98ab5f8fa942
- Verdict: PASS

## Final message

The branch removes the 29 tests the approved plan lists, by name, in 11 files, and changes nothing else. No test was skipped instead of removed, and no source, doc or role file changed. Every duplicate I re-broke by hand is still caught by the test the plan keeps for it. `npm run check` and `npm test` pass.

## Findings

None that block the merge.

- **Matches the plan:** every removed title in `context.test.ts` (8), `morning-report.test.ts` (3 plus the 5-section loop), `review-wake.test.ts`, `disk.test.ts`, `outside-text.test.ts` (2), `core-commands.test.ts` (whole file deleted), `ticket-command.test.ts` (2), `run.test.ts`, `jobs.test.ts`, `job-records.test.ts` (3) and `merge.test.ts` is one the plan names. The test count fell by exactly 29 (1696 now, against the worker's 1725 on main).
- **Leftover helpers and imports:** `tsconfig.json` has `noUnusedLocals` and `noUnusedParameters`, and `tsc` is clean, so nothing unused is left behind. `PROCEDURE` in `review-wake.test.ts` was used only by the removed test. The plan said it stays, so removing it departs from the plan, but the worker's message gives the reason (orphaned helpers go with their tests). The kept test builds its own throwaway template.
- **No `outcome.md`:** the plan's Files list asks for one, but the worker's reason holds. `packages/delivery/src/merge-command.ts:104` refuses a merge when the ticket folder already has an `outcome.md`, and `merge-outcome.ts:63`/`:107` builds that file from the worker's `## What went in` section, where the evidence is.

## Notes
- (risk) `spec/features/AR0685-…/ticket.md` (Done means, last point): the `npm test` count and time in CI, before and after, are not given. The "after" figure cannot exist until the branch reaches CI. In this worktree `arthur ci` is not available ("config file not found"). Whoever does the merge has to add these figures to the outcome.
- (minor) commit `074c341f` message: it says "19 wording and 10 duplicates", copied from the plan. The plan's own lists come to 20 wording tests (8+8+1+1+2) and 9 duplicates (1+2+1+1+3+1); the total of 29 is right.

## Checks (all on `074c341f`)
- **`npm run check && npm test`** (one call, timeout 1800): `tsc` gave no output; tests 1696, pass 1632, fail 0, cancelled 0, skipped 64, duration_ms 487989.
- **`npm run mutate`**: `mutate: 0 mutants, 0 caught, 0 survived`. There are no mutants because the branch changes no non-test source file.
- **Hand mutations**, one file each, each restored with `git checkout -- <file>`; `git status --short` was clean at the end:
  - `job-commands.ts` `if (words.includes(""))` → `if (false)`: `job-records.test.ts` "steer with an empty id or an empty text is refused…" fails (24 tests, 1 fail).
  - `lock.ts` takeover condition → `if (false)`: `lock.test.ts` "a lock of a dead pid, one that names no pid, or one an earlier boot wrote is taken over" fails with `board.lock: held by pid … for over 0.2 s`.
    - My first run of the whole `lock.test.ts` with this mutation hung and was killed at my 600 s timeout, so it gave no result. A `job-commands.ts` mutation was also in the tree for part of that run. The targeted rerun above is the result that counts.
    - That killed run left a test process behind (pid 2600745). It did not stop on SIGTERM, so I killed it with SIGKILL; `pgrep` now finds no `lock.test.ts` process.
  - `ticket-command.ts` `to === "planned" ? owner()` → `false ? owner()`: `cli.test.ts` "arthur ticket status <id> planned asks decision.owner…" fails (1 fail).
  - `merge-command.ts`: a plain merge asks nothing (`[`arthur merge ${job.id}`]` → `[]`): `merge-command.test.ts` "after a PASS, a merge asks the owner's decision for itself…" fails (1 fail).
- **Stale references:** `git grep core-commands.test` outside the AR0665/AR0685 folders finds nothing. `findings.md` does not exist on the branch.
- **Not re-run:** the `spawn.test.ts` constant-id mutation and the `npm test` run on main's tree are the worker's results only.

PASS