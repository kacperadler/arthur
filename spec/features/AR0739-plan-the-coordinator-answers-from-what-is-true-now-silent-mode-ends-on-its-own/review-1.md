# AR0739 - Review 1

- Job: 2026-11-25-review-90dd7c88
- Branch: arthur/2026-11-25-worker-17f11e76
- Commit reviewed: b1d7456c3f30f7b4a4cc03df7975d6e58dd4cca3
- Verdict: PASS

## Final message

No finding blocks the merge. The branch carries out the approved plan's five tasks (T1–T5), and each of the ticket's Done-means points has code and a test.

- **Cause 1, wrong status:** `inbox.ts` puts a `Jobs now: ...` line under every reply it sends. The line is read from the job records at send time, and a project agent's line counts only its own project's jobs. Held replies, notices and voice notes get no line. Both roles now say a status is written from `arthur jobs` run in that turn, and the new eval `status-from-jobs` holds that rule.
- **Cause 2, silent mode left on:** the mode always has an end now: `--until`, else 24 hours after `on`. A state file written before this change ends 24 hours after its `since`. The sweep turns the mode off by a rename and sends one notice with what happened meanwhile.
- **Cause 3, continue budget:** `continueJob` refuses a budget the job's cost has already reached, before any check or write. The message names the cost.
- **Cause 4, small budgets and tool loops:** `arthur stats budget` prints, per kind of ticket, the median worker cost and the cost 9 in 10 stayed within. A run that repeats the same failed tool call 5 times in a row ends with `limit: loop` and is not resumed.
- **Cause 5, hand-made retries:** a role sentence and the eval `room-refused-waits`.

Docs, roadmap entries 24 and 47, the plugin API table and the eval page all match the new behaviour. A search for the old wording ("stopped again at once", a bare `silent: on`, the old `HIDDEN` text) found nothing stale. The worker's claims (checks, mutate survivors, files) reproduce.

## Notes
- (risk) test/mutate.ts: the leftover processes the worker asked to file as F6 came back in this review. After my 4 `npm run mutate` calls, 4 processes of this checkout were still running: 2 `wrapper.ts` and 2 `omp --continue` coordinator sessions (one for agent `blog`), all under `/tmp/arthur-test-*`. I stopped them with `kill`, and `ps -p` then printed nothing. F6 is not in `findings.md` yet. [INFERENCE] they are left when mutate cuts or kills a test run partway; this repeats the worker's guess.
- (minor) packages/core/src/job-control.ts:116: the refusal ends `give one above $${cost}` with the raw number, while the plan's example shows 2 decimals ($49.77). The record holds 4 decimals, so the text stays readable.
- (minor) test/mutate.ts: its `INERT` pattern does not treat type-only lines that start with `|` or contain `=>` as inert. Survivors 1, 3, 4 and 5 are only such lines.
- (minor) packages/orchestration/src/context.ts:33: `jobsNow` sits in `context.ts`, a file the plan's Files list does not name. It sits beside `byState`, which it reuses, and the worker's message lists it.

## Checks (all on b1d7456c)
- **`npm run check`:** `tsc` passed with no errors.
- **`npm test`:** 1946 tests, 1882 passed, 0 failed, 64 skipped. The skipped ones are the tmux/Unix-socket tests the sandbox cannot run, finding F3; their 18 changed expectations stay unrun here too. I read the `NONE` expectations among them: each is a test where no job is still running. The structure test listed 6 yellow files and nothing in red.
- **`npm run mutate`:**
  - It took four calls: three were cut by time and the fourth finished.
  - The final summary: `100 mutants, 94 caught, 6 survived; 323 not run (--max 100)`.
  - The survivors are the same six the worker named, at `agent-stream.ts:6`, `stats-command.ts:13`, `run-record.ts:37`, `run-record.ts:38`, `silent.ts:36` and `silent.ts:68`. Each changes only types or comments, adds back an unused constant, or builds the same text.
- **Hand mutations:** each was restored with `git checkout --`, and `git status` was clean after.

| Mutation | Tests run | Result |
|---|---|---|
| `silent-end.ts`: the end check `<` changed to `<=` | `silent.test.ts` | 3 failed |
| `run-record.ts`: the same-call check removed (`failures + 1` always) | `run-record` + `limits` tests | 1 failed |
| `job-control.ts`: the continue refusal turned off | `job-control.test.ts` | 2 failed |
| `context.ts`: the project filter removed, plus the `HIDDEN` text in `stats-command.ts` changed | `project-routing` + stats tests | 3 failed |

PASS