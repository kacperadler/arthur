# AR0739 - Plan

- Job: 2026-11-24-plan-062156e1
- Planned at: a3e21a084b4c075c96b6945f1f07153d30d02780

## Approach

One task per cause. The plan follows a recommended option for each of the ticket's four product questions; the alternatives are under Open questions. I ran no checks in this checkout: the plan rests on reading the code.

Both `orchestration` (3242 of 3242) and `core` (7607 of 7607) sit exactly at their line budgets in `test/structure.test.ts`, so every added source line is a budget raise that shows in outcome.md.

**T1 - status taken from the records (cause 1): code, plus one role sentence and an eval.**
- The context already listed the review as `working` (`packages/orchestration/src/context.ts`, `### Jobs not ended`); the model overlooked it. More prompt data alone is not the fix.
- `sweep` in `packages/orchestration/src/inbox.ts` appends one line, built from `host.jobs.list()` at send time, to every reply it sends: `Jobs now: 1 working (review 953209e8), 1 blocked (worker 0a1b2c3d)` or `Jobs now: none`.
- A project agent's reply counts its own project's jobs only, as `footer` does. Held replies and notices get no line. The voice note (`voice-reply.ts`) is spoken from the text without the line.
- `roles/coordinator.md` and `roles/project.md` get one sentence: a reply that says what runs, ended or waits is written from `arthur jobs` run in that turn, never from memory; Arthur adds the jobs line itself.
- New eval `orchestration/status-from-jobs` holds that sentence.

**T2 - silent mode always has an end (cause 2).**
- `arthur silent on` and `/silent on` take `--until <HH:MM>` without `--recommend` too. Without it, the end is 24 hours after that `on`. A grant's `--until` is that same end.
- `silent.json` gains `until`. A state written before this change (no `until`) ends 24 hours after its `since`, so the six-day state would end at the first sweep.
- `arthur run` ends it at that time in the inbox sweep: the file is taken by a rename so only one process tells, each session's `silent-ask` is removed, and one `notice` goes to the owner, built without the model: `silent: off on its own, its end <HH:MM> on <day> <date> came (on since ..., for: <work>); meanwhile: ...`.
- The summary is the existing `meanwhile`. The context's `## Silent` line names the end. A broken state file stays as today (counts as on, the context names it).
- `silent.ts` is at 197 counted lines, so `meanwhile` and the new end move to a new `silent-end.ts`; `silent.ts` stays green.

**T3 - a continue that would stop at once is refused (cause 3).**
- `continueJob` in `packages/core/src/job-control.ts` refuses, before any check or write, when the record's `cost` has reached the budget in force (`reached` from `job-limits.ts`): the `--budget` given, else the record's.
- Message: `<id>: its cost $49.7700 reached the budget of $30, so its run would stop at once: --budget is the budget of all its runs together, not an amount on top; give one above $49.77`.
- `--budget` keeps its meaning (the total); `--budget 0` is still no limit. Delivery's hand-back already passes cost plus budget (`packages/delivery/src/hand-back.ts:146`) and is not affected.
- Role sentence: a budget question for a continue names the job's cost so far and asks for the new total.

**T4 - budgets that fit, and a loop stopped (cause 4).**
- Budget pick: a new read-only `arthur stats budget [--project <name>]` prints, per ticket kind, the count, the median and the cost 9 in 10 merged tickets stayed under, from the `- Cost:` line of each `outcome.md` that `packages/stats/src/tickets.ts` already parses. The role says a worker's budget, in the approval question and at spawn, is that 9-in-10 figure for the ticket's kind, named with its source.
- Measured here over `spec/features/*/outcome.md`, worker cost only: feat median $5.82, 9 in 10 under $13.62 (193 tickets); fix $2.28 and $9.69 (87); docs $1.53 and $6.04 (19). The budgets in the evidence ($1, $3, $10) were at or under the median.
- Loop stop: the wrapper ends a run `limit: loop: the agent repeated the same failed tool call 5 times (<tool> <detail>)` after 5 identical failed tool calls in a row. The detection lives in `run-record.ts`, because `wrapper.ts` is at 219 lines, one under red. No resume follows a loop, as after a time limit.

**T5 - room again, no hand-made retries (cause 5): role and eval only.**
- Neither role mentions the `[Arthur: resources]` message of AR0735, and no procedure tells the coordinator to schedule retries; it invented them.
- One sentence in both roles: a spawn or continue `refused by resources: no room` waits for the `[Arthur: resources]` message that the machine has room again; never a schedule entry or a sleep to retry.
- New eval `orchestration/room-refused-waits` holds it.

**Left alone:** AR0726 and the autopilot budget and cap; how a grant answers decisions; what silent mode holds and lets through; `arthur jobs`; the resources plugin; channels; `spec/vision.md`.

## Not available directly

- none

## Files

- `packages/orchestration/src/inbox.ts`: `sweep` appends the jobs line to each sent reply, passes the voice note the text without it, and calls the silent end each sweep.
- `packages/orchestration/src/silent.ts`: `until` in the state and its parse; `--until` accepted without `--recommend`; the end named in the `on` answer and in `silentContext`; `meanwhile` moves out.
- `packages/orchestration/src/silent-end.ts` (new): `meanwhile`, and the end on its own (rename, remove asks, the notice).
- `packages/orchestration/roles/coordinator.md`, `packages/orchestration/roles/project.md`: the sentences of T1, T2 (give `--until` with the work's time limit; silent ends on its own), T3, T4 and T5.
- `packages/orchestration/docs/commands/silent.md`, `packages/orchestration/docs/commands/coordinator.md`: the end, the state's `until`, the notice; the jobs line under a reply.
- `packages/orchestration/evals/status-from-jobs/`, `packages/orchestration/evals/room-refused-waits/` (new): `scenario.json` and `fixture/`, copied from `night-one-line` and `no-sleep`.
- `packages/develop/test/scenarios.test.ts`: the right and wrong turn of both scenarios; the scenario count 20 to 22.
- `packages/develop/docs/commands/eval.md`: the two names in the scenario list.
- `evals/baseline.json`: a placeholder `{ "passed": 0, "runs": 1 }` for each new scenario, as AR0716 did, because a job may not run `arthur eval`.
- `packages/orchestration/test/silent.test.ts`, `packages/orchestration/test/inbox.test.ts`: new tests; expected reply texts gain the jobs line.
- `packages/core/src/job-control.ts`: the refusal in `continueJob`.
- `packages/core/src/agent-stream.ts`: the tool call's full arguments on `tool`, and `isError` on `tool-end`.
- `packages/core/src/run-record.ts`: counts identical failed calls in a row and calls back at 5.
- `packages/core/src/job-ending.ts`, `packages/core/src/wrapper.ts`: the `loop` ending; the wrapper passes `() => halt("loop")` on its existing `runRecord` line. [INFERENCE] `Why` is declared in `job-ending.ts`: it is exported from there, but I read only its first lines.
- `packages/core/docs/commands/continue.md`, `spawn.md`, `jobs.md`: the refusal replaces "stopped again at once"; `limit: loop` among the endings.
- `packages/core/test/job-control.test.ts`: the test at line 470 ("stopped at once at the budget its cost already reached") becomes the refusal test; a loop test with the fake agent's `failed` tool steps (`fake-agent.ts:118`).
- `packages/stats/src/tickets.ts`, `packages/stats/src/stats-command.ts`, `packages/stats/docs/commands/` (a new `stats-budget.md`), `packages/stats/test/`: `arthur stats budget`. [INFERENCE] how `stats-command.ts` routes its subcommands: I did not read it.
- `test/structure.test.ts`: raise `orchestration` and `core` by the lines added, and `stats` if it has no room. [INFERENCE] stats' counted lines were not measured; its raw total is 545 of 575.
- `spec/roadmap.md`: entry 47's text, if it describes how silent ends. [INFERENCE] not read.

## Risks

- Existing tests compare `coordinator-replied` text exactly; each gains the jobs line. The worker updates them in the same commit and keeps the line out of held replies and notices.
- A grant bounded only by `--usage` or `--tickets` had no time limit; it now ends with silent mode after 24 hours. `/silent on ... --until` sets a later end, and the notice says the mode ended.
- The live `silent.json` has no `until`: at the first sweep after the merge and restart, silent mode ends and the owner gets a summary of everything since it went on. That is intended, but it may be long.
- `arthur silent off` by hand at the same instant as the end: the rename makes one of them tell; the other answers `silent: off`. Tested with two calls.
- The continue refusal also stops `host.jobs.continue` without a budget (`decision-hooks.ts:42`) for a job at its budget; its existing `told` path reports the refusal to the coordinator.
- Loop stop false positives: only identical arguments, failed, with no other tool call between, count; an edit between two failing test runs resets it.
- [INFERENCE] real omp's `tool_execution_end` carries `isError`: seen only in `packages/core/src/fake-agent.ts:123`, which mirrors omp. The worker confirms against one real job log before building; if it is absent, the loop stop is left out and reported.
- The two eval baselines are placeholders until the coordinator runs `arthur eval orchestration/status-from-jobs orchestration/room-refused-waits --save-baseline` after the merge.

## How to test

- Cause 1: `inbox.test.ts`, a sent reply's event text ends with `Jobs now: ...` built from the records (a working job, a blocked job, none; an agent's own project only; a held reply and a notice without it). `scenarios.test.ts`, `orchestration/status-from-jobs`: the right turn (calls `arthur jobs`, the reply names the working review) passes, the wrong one fails.
- Cause 2: `silent.test.ts`:
  - `on` writes `until` (given, default 24 hours, a grant's);
  - at the end, the sweep removes the state and emits one notice with the summary; nothing before the end;
  - a state without `until` ends 24 hours after `since`;
  - a second end or a hand `off` at once tells once;
  - a reply after the end is sent, not held;
  - a broken file stays on.
- Cause 3: `job-control.test.ts`:
  - `--budget` at or below the cost is refused with the cost in the message, nothing written, no agent start;
  - one cent above goes through;
  - a continue without `--budget` at its budget is refused;
  - `--budget 0` goes through;
  - the `arthur continue` binary exits 1 with the message.
- Cause 4: `packages/stats/test/`, `arthur stats budget` over tickets of two kinds, an unknown cost left out, no merged ticket, wrong usage. `job-control.test.ts` or a wrapper test: 5 identical failed calls end `limit: loop`; 4 do not; a different call between resets; successful repeats never count.
- Cause 5: `scenarios.test.ts`, `orchestration/room-refused-waits`: the right turn (a refused spawn, a reply that says it waits for room) passes; a turn that runs `arthur schedule add` or `sleep` fails.
- Each test above fails on today's code. Then `npm run check && npm test && npm run mutate` pass, the structure test included with the raised budgets.

## Open questions

- Cause 1: the plan adds a `Jobs now: ...` line, built by Arthur, under every reply the coordinator sends. Do you want it under every reply, only under replies to your own messages, or not at all (the role sentence and the eval only)?
- Cause 2: the plan ends silent mode at `--until`, else 24 hours after `on`, and Arthur sends you the summary itself. Do you prefer the default end at the end of your quiet hours, or silent mode kept on with a reminder line under each reply instead of an end?
- Cause 3: the plan refuses a budget at or below the job's cost, and also a continue without `--budget` on a job already at its budget. Should `--budget` instead mean an amount added on top? That would change what `arthur jobs` and the autopilot cap compare.
- Cause 4, budget: the plan picks a worker's budget from the cost 9 in 10 merged tickets of the same kind stayed under (feat about $13.60, fix about $9.70, docs about $6). Is 9 in 10 the right mark, or the median with one raise expected?
- Cause 4, autopilot: its default of $1 and cap of $3 are under the median fix ($2.28). Should they rise? The plan leaves them (AR0726 is out).
- Cause 4, loop: stop a run after 5 identical failed tool calls in a row, yes or no, and is 5 the number?