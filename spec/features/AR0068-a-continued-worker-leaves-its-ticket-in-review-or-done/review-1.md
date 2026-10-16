# AR0068 - Review 1

- Job: 2026-10-16-review-ar0068-continue-m-9d90b36c
- Branch: h/2026-10-16-ar0068-continue-moves-ti-50bbce43
- Commit reviewed: 10f3f921a10878ffd4b80aa744c605857ce2e6df
- Verdict: PASS

## Final message

Worktree clean, no leftover edits.

**Findings:** none that block merge.

**Notes:**
- `job-control.ts` reads the task's `Ticket:` string twice per continue (once in the caller's `checkSpawn` wrapper, once via `taskTickets(task)` at the emit) — duplicated parse of the same string, not a correctness issue, documented and justified by the line-budget constraint.
- Side effect (a record with its `branch` file hand-deleted is now refused instead of silently continuing) is a behavior change on an edge case outside normal operation (spawn always writes `branch`, confirmed in `job-record.ts:17`); documented in the final message and arguably safer than the prior silent fall-through.

**Checks run (in this worktree, against `aaf02ba5..10f3f921`):**
- `npm ci`: ok.
- `npm run check` (`tsc`): passes, no output — matches claim.
- `npm test`: 272/272 pass — matches claim.
- `wc -l` over `packages/core/src/*.ts`: 4372 total — matches claimed budget exactly.
- Mutation: commented out the new `bus.emit("core", "job-started", ...)` line in `job-control.ts` and reran `packages/core/test/job-control.test.ts` — the new test "a continued worker moves its ticket from review back to in-progress…" fails with `actual: 'review', expected: 'in-progress'`, all 19 other tests in that file still pass. Restored via `git checkout -- packages/core/src/job-control.ts`; `git status` clean afterward.
- Traced event flow: `moveStartedTickets` (`board-jobs.ts:34`) is the only core subscriber of `job-started`; filters on `kind !== "worker"`, unchanged by this diff, confirmed by the new test's `audit` sub-case (continued, status stays `review`). `board.move` to the same status is a no-op with no event (`board.ts:111-112`), confirmed by the new test's third-continue assertion (file content/mtime unchanged, no new `ticket-moved`).
- Confirmed emit placement: after record/log writes (`write(folder, "continue", ...)`, `appendFileSync(... log)`), before `await launch(...)` which starts the wrapper — matches the Done means' required order, and `Bus.emit` is synchronous (`events.ts:16` returns `Event`, not a `Promise`).
- Confirmed emitted payload shape (`id, kind, project, root, branch, worktree, tickets`) matches the spawn's own emit at `jobs.ts:149` field-for-field.
- Checked only one plugin package exists (`packages/core`) — no plugin currently subscribes to `job-started`, matching the "no plugin exists yet" claim.
- Docs (`continue.md`, `spawn.md`, `ticket.md`) read and cross-checked against the code; wording matches actual behavior (fields emitted, "already there is not written", cross-links to `--help`).

PASS
