# AR0048 - Review 1

- Job: 2026-10-16-review-ar0048-refuse-spa-288b3c23
- Branch: h/2026-10-16-ar0048-refuse-spawn-on-u-b2cbf1cc
- Commit reviewed: 8abe0aa3c0c6a636d04e667ed769181955c10fce
- Verdict: PASS

## Final message

All 189 pass, clean worktree.

Findings: none that block merge.

Notes:
- F1 race (ticket moved to merged/dropped during the spawn window between the check and `job-started`) is honestly disclosed, correctly scoped out of this ticket per the AR0014-overlap instruction, and recorded in `findings.md` with the `[INFERENCE]` tag since it wasn't reproduced. Acceptable per the ticket's scope constraint.

Checks run (in this worktree, range `796f63be..8abe0aa3`):
- `git diff --stat` on the range: 4 files, +72/−13, matches the worker's claim; `jobs.ts` and `board.ts` untouched, as promised.
- `npm ci`: clean.
- `npm run check` (`tsc`): clean, no output.
- `npm test`: 189/189 pass, matching the worker's claim exactly.
- Read `host.ts` diff: `beforeSpawn` runs inside `jobs.ts`'s `spawn` before `newJob`/`addWorktree`/`writeRecord`/`job-started` — confirmed nothing is created before the refusal.
- `STARTS` derived from `NEXT`/`STATUSES` (board-file.ts move table), not a hardcoded list: `planned, in-progress, review, done` — matches Done means and the ticket's own wording.
- Read `spawn.test.ts` diff end to end: refusal test covers planning/merged/dropped/unknown/joined-message, asserts no job/event/branch created, and that review-kind and in-progress/review/done-status worker spawns still succeed and move the ticket; new no-project-list test (previously silent stderr line, now a hard refusal) and a no-`Ticket:` task still starting.
- Doc diff (`spawn.md`) matches the new refusal message and amends the `job-started` line to describe the only-after-check-window race — consistent with F1.
- Mutation checks I ran myself (each restored via the backed-up file, `git status` clean afterward):
  - Removed the `kind !== "worker"` filter → `review`/`done` spawn in the refusal test fails (1 ≠ 0). Caught.
  - Made the check always `return undefined` → no-project-list test fails (exit 0 vs expected 1, old stderr line reappears). Caught.
  - Removed the direct `in-progress` inclusion from `STARTS` (kept only `NEXT[status].includes`) → refusal test's expected message text fails. Caught.
- Confirmed via `board.ts`/`jobs.ts` reading that the "no project list" throw path and its wrapped `plugin core: beforeSpawn failed: ...` message match the test and docs exactly.

PASS
