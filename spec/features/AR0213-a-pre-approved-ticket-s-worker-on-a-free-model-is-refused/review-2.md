# AR0213 - Review 2

- Job: 2026-10-19-review-ar0190-core-batch-425af052
- Branch: h/2026-10-19-ar0190-core-batch-2-27eddfc2
- Commit reviewed: 1fea234fb46cbcb9c9ba796f4debb16c2f64d693
- Verdict: PASS

## Final message

## Review: merge commit 1fea234

### What changed in scope
The only new commit since the earlier PASS (`a2fd7aa`) is the merge `1fea234` (`a2fd7aa` + `a3b98c0` → merge, signed off). Verified the conflict resolution in each listed file.

### Findings

None blocking.

### Notes (non-blocking)

- `packages/core/src/job-control.ts:86`: during `continue`, the `job` object handed to each plugin's `prepare` now carries `cpu`/`memory`/`feature` from the freshly-fetched caps (`passed.caps`) rather than the record's stale ones — matching `continue.md`'s claim ("the job … with the caps in force now"). No test exercises this specifically: I mutated the line to `const job = { ...asked }` (stale caps) and re-ran the targeted scope/model tests — none failed, because no registered `prepare` in the codebase (`models`, `nvm`, `commit-rules`, `projects`) reads `job.cpu`/`memory`/`feature`. The value is currently inert; it's correct per docs and doesn't regress anything observable today, so I'm not failing the merge over it, but it's worth a test once a plugin's prepare starts reading caps.
- The `telegram.test.ts:382` flake the worker reported (F2, already filed as open) did not reproduce: full suite run twice (734/734 both times) and the file alone 10× under `taskset -c 0,1` (10/10). The merge's only touch to `packages/telegram/` is main's `API_URL` constant (AR0177) and an unrelated option-defaults test; the "one retry per send" test's code and logic are untouched by this merge. So if the flake is real, it predates this merge and isn't caused by the conflict resolution — the worker's F2 entry (open, not blocking) is the right place for it.

### Verified

- `jobs.ts`: 193 lines (≤200 budget), `Kind` moved to `job-kinds.ts` as claimed.
- `job-control.ts`: both main's AR0145 (caps re-asked via `recordedJob`, caps written via `capFields(passed.caps)`) and the branch's AR0190 (prepares re-run with `continued=true`) present together; confirmed by existing tests `scope.test.ts` ("caps in force now…") and `model.test.ts` ("runs the prepares again, told it is a continue…" — mutated `true→false`, test caught it).
- `remote-job.ts` `continue` step: reads `<caps>` positional + `{instruction, env}` on stdin, in the order `continueJob` sends them; exercised by `machine.test.ts` "a block with stop on a job there … the feature slice goes there, a continue's caps too" (passes caps through both the local and remote record files).
- `job-record.ts`: `capFields` (main) and `free`/`recordedJob` (branch) coexist as claimed.
- Docs `continue.md`, `remote-job.md`, `spawn.md` match the merged code's behavior (caps-replace, prepares-again, `<caps>` arg + stdin).
- AR0198 (prompt section `{text, warnings}` joined) and AR0202 (wrapper ends when `pid` file goes missing) both intact post-merge.
- `test/structure.test.ts`: `node --test test/structure.test.ts` → 15/15 pass; `BUDGETS` (core 5549, schedule 570, each other plugin's `+1` for its `module` line) checked against `wc -l`/manual summation — all consistent.
- SSH argv quoting (`job-machine.ts:22`, pre-existing, unmodified by this diff) safely single-quotes the new `JSON.stringify(caps)` argument; no injection surface added.
- No scope creep: the merge diff is exactly origin/main's commits plus the documented conflict resolutions; nothing touched outside that.

### Checks run (in this worktree, not the main checkout)

- `npm install`: up to date.
- `npm run check`: clean, no errors.
- `npm test` (full suite), run 1: `tests 734 / pass 734 / fail 0`, exit 0, 241.6s.
- `npm test` (full suite), run 2: `tests 734 / pass 734 / fail 0`, exit 0, 241.5s.
- `taskset -c 0,1 node --import @arthur/core/testing --test packages/telegram/test/telegram.test.ts` × 10: 10/10 exit 0, `fail 0` each time.
- `node --test test/structure.test.ts`: 15/15 pass.
- Mutation checks (throwaway, reverted via `git checkout --`): continue's `continued` flag (caught by `model.test.ts`); continue's `job.cpu/memory/feature` fed to `prepare` (not caught by any test — noted above, not blocking).
- `git status --short`: clean after mutation checks.

PASS
