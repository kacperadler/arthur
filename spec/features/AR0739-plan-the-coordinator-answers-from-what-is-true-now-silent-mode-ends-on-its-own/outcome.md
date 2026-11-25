# AR0739 - Outcome

- Merged: 2026-11-25, `5eeebb24`
- Branch: arthur/2026-11-25-worker-17f11e76
- Reviews: review-1.md PASS
- Cost: worker $1.01, reviews $1.56; review rounds 1

## What went in

- README.md: names `arthur stats budget`, what the workers of merged tickets cost per kind of ticket.
- docs/plugin-api.md: `coordinator-replied`'s `text` now carries Arthur's own `Jobs now: ...` line under the reply.
- docs/setup.md: names `arthur stats budget` beside the tickets report.
- evals/baseline.json: placeholder baselines for `orchestration/status-from-jobs` and `orchestration/room-refused-waits`.
- packages/core/docs/commands/continue.md: `--budget` is the total of all runs; a budget the cost already reached is refused, and the message names the cost.
- packages/core/docs/commands/help.md: `arthur stats budget` is listed among the commands a job may run.
- packages/core/docs/commands/jobs.md: `limit: loop` added to the endings.
- packages/core/docs/commands/spawn.md: the loop stop (5 identical failed tool calls in a row) and the continue refusal replace "stopped again at once".
- packages/core/src/agent-stream.ts: tool events carry the call's id and full arguments (without the intent `i`); a tool's end carries omp's `isError` as `failed`.
- packages/core/src/job-control.ts: `continueJob` refuses a budget the record's cost has already reached, before any check or write.
- packages/core/src/job-ending.ts: the `loop` ending and its reason text.
- packages/core/src/run-record.ts: counts identical failed tool calls in a row and calls `loop` once at 5.
- packages/core/src/wrapper.ts: stops the run with `limit: loop` when the record reports a loop, with no resume.
- packages/core/test/job-control.test.ts: the continue refusal (at, below and one cent above the cost; no `--budget`; `--budget 0`; the binary).
- packages/core/test/limits.test.ts: 5 identical failed calls end the job `limit: loop`; 4, or a different call between, do not.
- packages/core/test/run-record.test.ts: loop counting, its reset and resets, and a record without a cost.
- packages/develop/docs/commands/eval.md: the scenario list names `status-from-jobs` and `room-refused-waits`.
- packages/develop/test/scenarios.test.ts: the right and wrong turn of both new scenarios.
- packages/orchestration/docs/commands/coordinator.md: the `Jobs now: ...` line under each sent reply.
- packages/orchestration/docs/commands/silent.md: `--until` without `--recommend`, the default 24-hour end, the state's `until`, the end on its own and its notice.
- packages/orchestration/evals/room-refused-waits/fixture/.gitignore: fixture repository of the new eval.
- packages/orchestration/evals/room-refused-waits/fixture/README.md: fixture repository of the new eval.
- packages/orchestration/evals/room-refused-waits/fixture/spec/build.json: fixture repository of the new eval.
- packages/orchestration/evals/room-refused-waits/fixture/spec/features/SH0011-warn-when-a-product-has-no-image/ticket.md: the fixture's ticket.
- packages/orchestration/evals/room-refused-waits/fixture/spec/vision.md: the fixture's vision.
- packages/orchestration/evals/room-refused-waits/scenario.json: a spawn refused for room waits for the resources message; no schedule entry, no sleep.
- packages/orchestration/evals/status-from-jobs/fixture/.gitignore: fixture repository of the new eval.
- packages/orchestration/evals/status-from-jobs/fixture/README.md: fixture repository of the new eval.
- packages/orchestration/evals/status-from-jobs/fixture/spec/build.json: fixture repository of the new eval.
- packages/orchestration/evals/status-from-jobs/fixture/spec/features/SH0011-warn-when-a-product-has-no-image/ticket.md: the fixture's ticket.
- packages/orchestration/evals/status-from-jobs/fixture/spec/vision.md: the fixture's vision.
- packages/orchestration/evals/status-from-jobs/scenario.json: a status reply is written from `arthur jobs` run in that turn.
- packages/orchestration/roles/coordinator.md: status from `arthur jobs`, silent's end, budget from `arthur stats budget`, a continue budget above the cost, waiting for room.
- packages/orchestration/roles/project.md: the same sentences for a project agent.
- packages/orchestration/src/context.ts: `jobsNow`, the `Jobs now: ...` line built from the job records.
- packages/orchestration/src/inbox.ts: the sweep appends the jobs line to each sent reply (not to held replies, notices or voice notes) and ends silent mode when its end comes.
- packages/orchestration/src/silent-end.ts: the silent state and its parse, the end (`until`, else 24 hours after `since`), turn-off by rename, `meanwhile`, and the end-on-its-own notice.
- packages/orchestration/src/silent.ts: `--until` accepted without `--recommend`; `on` writes `until` and names the end; the context line names the end.
- packages/orchestration/test/hand-over.test.ts: expected reply texts gain the jobs line.
- packages/orchestration/test/inbox-setup.ts: `NONE`, the jobs line when no job runs.
- packages/orchestration/test/inbox-start.test.ts: expected reply texts gain the jobs line.
- packages/orchestration/test/inbox.test.ts: expected reply texts gain the jobs line.
- packages/orchestration/test/project-routing.test.ts: the jobs line from the records, a project agent's own jobs only, none on held replies and notices.
- packages/orchestration/test/silent.test.ts: `until` given, defaulted and from a grant; the end on its own; an old state; ending twice tells once; a broken file stays on.
- packages/orchestration/test/voice-reply.test.ts: the voice note is spoken without the jobs line.
- packages/stats/docs/commands/stats-budget.md: new doc page of `arthur stats budget`.
- packages/stats/docs/commands/stats.md: `budget` among the subcommands, and the refusal text inside a job.
- packages/stats/docs/stats.md: describes `arthur stats budget`.
- packages/stats/src/stats-command.ts: routes `arthur stats budget`; shares the usage line with `tickets`.
- packages/stats/src/tickets.ts: `budgetStats`, per kind of ticket: count, median and the cost 9 in 10 stayed within.
- packages/stats/test/spend.test.ts: the refusal text inside a job names `arthur stats budget`.
- packages/stats/test/tickets.test.ts: `arthur stats budget` over two kinds, an unknown cost, no merged ticket, wrong usage, kinds with as many tickets.
- spec/features/AR0739-plan-the-coordinator-answers-from-what-is-true-now-silent-mode-ends-on-its-own/findings.md: findings F1 to F5, open.
- spec/roadmap.md: entry 47's silent end and jobs line, and the two evals.
- test/job-gate.test.ts: `arthur stats budget` runs inside a job; the refusal text names it.
- test/structure.test.ts: line budgets raised (core 7650, orchestration 3322, stats 603).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1892/1963 passed.

## Left open

- Deferred (client summary): F1. A silent state file that does not parse still stays on for good
- Deferred (client summary): F2. The loop stop rests on omp's `isError`, not seen on the tool loop that prompted it
- Deferred (client summary): F3. A worker cannot run the 39 orchestration tests that need tmux, and this branch changed what 18 of them expect
- Deferred (client summary): F4. Autopilot's default budget of $1 and cap of $3 are under what a fix usually costs
- Deferred (client summary): F5. A crash between taking the silent state and telling leaves the mode off and the owner not told
- Deferred (client summary): F6. the leftover processes the worker asked to file as F6 came back in this review
