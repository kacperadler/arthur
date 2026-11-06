# AR0480 - Plan

- Job: 2026-11-06-plan-578a05ea
- Planned at: aa12047d22c774fb6a77ede8e6d228ce6fb78413

## Approach
This ticket changes only this plan. It writes no code and does not touch the roadmap or the vision. I ran the checks at HEAD in this checkout: `npm run check` (tsc) is clean, and `npm test` gives 1583 tests, 1519 pass, 0 fail, 64 skipped.

**In short.** A new optional `stats` plugin keeps two append-only files in its own folder:
- one line per job run, written when the run ends;
- one line per coordinator turn.

It shows them as `arthur stats` and `/stats`, and as one section of the morning report. The core gets one small addition: the job record keeps the tokens per model, beside the `cost` it already keeps. manage's merged-ticket report moves into the new plugin as `arthur stats tickets`.

Left alone:
- the event log and the `job-ended` event (its data stays as it is);
- the budget logic;
- `arthur usage`;
- delivery's `outcome.md` costs (AR0474 was merged on 2026-10-27, and its fix stays as it is);
- the activity log plan (AR0527).

Two smaller decisions, each with options under Not available directly:
- The share of a Claude usage window per role is an estimate.
- The coordinator's spend before the plugin is installed is not imported.

The plan follows the recommended option of each.

What the numbers look like today. I measured the coordinator's own omp session files under `~/.omp/agent/sessions/<the folder of arthur run's working folder>/`, at omp's own prices:

| Coordinator session file | Assistant messages | Cost at omp's prices |
| --- | --- | --- |
| 2026-10-29 22:15 to 10-30 22:00 | 815 | $252.35 |
| 2026-11-02 22:00 to 11-06 08:18 | 2207 | $901.89 |

All of it was `anthropic/claude-opus-5-5`, and none of it is recorded by Arthur today. The account shows Claude "7 Day" windows in `omp usage --json`. So these dollars are most likely what the same tokens would cost on the API, not money paid [INFERENCE: subscription, from the windows and the session's `credential_pin` line]. Every view therefore labels cost as "at list price".

**1. Source: where each number comes from.**

*A job.* `omp --mode json` already gives each assistant message's `usage` to the wrapper: `{ input, output, cacheRead, cacheWrite, cost: { total } }`, plus `model` and `provider`. A job's own session file shows the same shape. `agent-stream.ts` reads only `usage.cost.total` today, and `run-record.ts` adds it into `cost`.
- Option A: the wrapper also keeps tokens per model in a new record file, `usage`. It is cumulative over the job's runs, as `cost` is, written after each message as `cost` is, and given to plugins in `host.jobs.list()`. About 30 core lines.
- Option B: stats reads `<home>/jobs/<id>/session/*.jsonl`. No core change. But it is omp's internal format, it is the core's folder and not stats' own (styleguide, Shape), and a job on another machine has no session file here.
- Option C: `job-ended` carries the usage. `job-ended` is emitted from 6 places (`wrapper.ts:198`, `job-control.ts:72`, `job-records.ts:106`, `job-scope.ts:112`, `machine-sync.ts:100` and `:124`). Four of them never see the agent's output, so they would have to read a file anyway.
- Recommendation: A. On every `job-ended`, stats reads that job's line from `host.jobs.list()`. The record still exists then: it is pruned later. A job's time is the `seconds` that list already gives, its `ran` file, which `job-state.ts:70` writes before `job-ended` is emitted.

*The coordinator and a project agent, whose sessions never end.*
- Option A: an OMP extension that stats gives to the coordinator through `collect("coordinator.extension")`. The session plugin already uses that mechanism (`session.ts:56`, `coordinator.ts:50-62`). At each real end of a turn (`agent_end` with `willContinue !== true`, the event `turn-extension.ts` already relies on), it appends one line: the tokens and cost of the assistant messages with a `timestamp` after the last one it counted, and the seconds since `agent_start`. Each line also keeps that last timestamp (`until`), and at start the extension reads it from the file's last line. A resumed turn or a `--continue` conversation is then never counted twice.
- Option B: read omp's session files of the coordinator. This is omp's internal format, in a folder outside Arthur's home.
- Option C: one line a day from `omp usage`. It has no tokens or cost per session.
- Recommendation: A.
  - A session without a UI (a `task` subagent, which the existing extensions skip with `!ctx.hasUI`) is counted under the same session, marked `sub: true` [INFERENCE: those guards show that extensions load in subagents].
  - Entry 85's project agents load the same extension. Their session name comes from a variable that orchestration sets for each session; 85's ticket adds that variable. Until then the name is `coordinator`.

*A job on another machine (roadmap 21, 30).* The wrapper there writes `usage` the same way, and the sweep copies it here with the other run files. `usage` joins the `RUN` list in `machine-sync.ts:27`. Stats reads it here on that `job-ended`.

*A local model (Ollama).*
- omp reports its tokens with a cost of 0 [INFERENCE: no price is known for such a provider; the models plugin already gives a free model's job no budget, `job-model.ts:24`].
- Stats keeps the tokens and shows cost $0. A model with tokens and no cost is listed as `free`.
- No made-up price is added.

*Known gap.* omp's own side calls (compaction, the `--smol` model) are counted only if they come out as assistant messages. That is the same gap the `cost` budget has today [INFERENCE].

**2. Record: where it is kept.**

Folder `<home>/stats/`. Like every plugin folder it is outside Git and untouched by `arthur prune`, which removes only job records. A restart only reads it again.

`runs.jsonl` holds one line per `job-ended`:

```
{ seq, time, job, kind, project, tickets, machine, state, reason, seconds, cost,
  usage: { "<provider>/<model>": { messages, input, output, cacheRead, cacheWrite, cost } },
  missing?, backfill? }
```

- **Numbers.** Each line holds what this run added: the record's totals now minus the job's earlier lines. A continued job's second run is therefore counted on the day it ran, and a second `job-ended` for the same run (blocked, then stopped) adds 0.
- **Writer.** Only `arthur run` writes, after its `start`. Events that come before `start` (the replay of `follow`, `run.ts:55-64`) wait in memory. A command process such as `arthur stop` delivers its own `job-ended` to itself and never calls `start`, so it writes nothing. A line whose `seq` is not above the last one written is skipped, so a replay after a crash writes nothing twice.
- **Missing record.** A job whose record is already gone when the event is read (a hand `arthur prune` while `arthur run` was down) gets a line with `missing: true`. Its numbers are unknown, and every view counts such lines under "unknown".

`sessions/<session>.jsonl` holds one line per turn: `{ time, session, seconds, until, sub?, cost, usage }`. Each session has its own file, so each file has one writer: the extension of that session's single omp. A new coordinator start waits for the old omp to exit (roadmap 23).

The rules for both files:
- Each line is one append ending in `\n`.
- A last line cut by a crash first gets its line break, as `event-log.ts` does.
- A reader skips a line it cannot parse, and counts it.
- Retention is forever. The size is about 165 job runs a day and about 100 turns a day (from the counts in AR0527's plan) at 300 to 400 bytes a line, so roughly 30 MB a year. Splitting by month waits until a read is measured slow.

A job already pruned, or run before stats was installed:
- Option 1: not counted.
- Option 2: at its first `start` (no `runs.jsonl` yet), stats writes one `backfill: true` line for every ended record that `host.jobs.list()` still holds: cost and seconds, with tokens only where `usage` exists.
- Option 3: the tickets' `outcome.md` costs. These are worker and reviews only, with no day and no tokens, and they would count twice any ticket whose records still exist.
- Recommendation: 2. The merged-ticket report keeps showing `outcome.md` costs for older tickets, as it does today.

**3. Plugin.**
- Option A: grow `manage`. It is at its budget (1355 of 1355, measured at HEAD), and spend is not managing Arthur.
- Option B: a new `stats` plugin with its own command name (`arthur spend`), leaving manage alone. That is two "stats", and the ticket names the view `arthur stats`.
- Option C: a new optional `stats` plugin that takes `arthur stats`, with manage's merged-ticket report (`stats.ts`, 103 lines, and its command) moved into it.
- Recommendation: C. A command name registered twice refuses the load (`host.ts`), so the report has to move before stats registers the name.
  - manage's audit and retro prompts get their `### Stats` section through `collect("stats.tickets", project, since)`. Without the stats plugin that section reads `none: the stats plugin is not loaded`.
  - manage keeps `mergedSince` (3 lines), which the audit uses for its deferred findings.
  - manage's line budget drops by what moves.
- Line budget: about 200 for entry 109, then +120 (110), +200 (111) and +50 (112). The first budget of a new package is the owner's to set (Open questions).
- The core interface it needs:
  - `usage` in the job record and in `JobRecord` (`job-records.ts:22`), a change to the frozen API (51), recorded as a decision in 108's ticket;
  - nothing else new: `job-ended`, `host.jobs.list()`, `coordinator.extension`, `host.job`, `collect` and `provide` all exist today.
- Raises:
  - core about +30 (7239 today);
  - core/testing +3 (403), for a `usage` option on the fake agent's message step (`fake-agent.ts:107-108`);
  - models +10 (537), in 112.

**4. Views.**

`arthur stats [--since today|yesterday|<n>d|YYYY-MM-DD] [--project <name>] [--role <role>] [--ticket <id>] [--model <provider/model>]`:
- **Default.** The last 7 days, every project. `--project` here narrows; for other commands it switches the project.
- **Role.** A job's role is its kind. Today each kind has one role (worker, review→reviewer, plan→planner, plan-review, audit, retro, onboarding: the `registerKind` calls I read). `coordinator` and, later, `agent:<project>` are the sessions. A kind a plugin registers later (a "tester") is counted under its own name.
- **What it prints:**
  1. Total: cost at list price, tokens (in, out, cache read, cache write), time, runs and turns.
  2. By role, the most expensive first: cost, share, runs, how many failed or were stopped.
  3. By project.
  4. By model, with tokens on free models on their own line.
  5. By day.
  6. The 5 most expensive tickets, each split by role, with its board status. A run that names several tickets gives each an equal share.
  7. Whether it pays: spend on tickets merged in the span and per merged ticket, on dropped tickets, on runs that failed or were stopped, and on work with no ticket (the coordinator, audits).
  8. Unknown and unparsed lines.
- **`--ticket`.** Lists that ticket's runs one per line: date, role, model, state, cost, tokens, time.
- **Inside a job.** A job's home is hidden from it (`job-sandbox.ts:99-119`), so `arthur stats` inside a job says so in one line and exits 1. `arthur stats tickets` keeps `inJob: true`, as today.

`arthur stats tickets [--project <name>]`: manage's report as it is today (`docs/commands/stats.md`).

`/stats [today|yesterday|7d|30d|YYYY-MM-DD] [<ticket id>]`: the first two sections and the top 3 tickets, answered without the model.

Morning report: a sixth section, "Spend", in `roles/coordinator/morning-report.md`. It holds the first two lines of `arthur stats --since 1d`, and is left out when the reply is `unknown command stats`, as "Needs attention" is for health.

Web panel (AR0086, roadmap 77), later: a Spend screen with the same filters, by day and role, read through the server's commands (76). Its plan adds `--json`. Nothing of it is built here.

**5. The Claude usage windows beside the costs.** omp reports each window's `usedFraction`, `durationMs` and `resetsAt` for the whole account (I ran `omp usage --json`). The models plugin keeps all of these but `durationMs` (`usage.ts:31-34`). Options are under Not available directly. Recommendation, entry 112:
- `arthur stats windows`: one line per window. For example: `7 Day 40% used; in its span Arthur spent $X at list price: coordinator 61%, worker 22%, ...`.
- With the estimate `≈ used × the role's share`, marked as an upper bound, because the owner's own use of the account counts in the window too.
- It needs a new `models.windows` provide that gives the windows with `durationMs`.

**6. Roadmap.** AR0527 holds 99 to 101 and the releases hold 104 to 107, so the new entries take 108 to 112. They go in a new section `## Stats`, after `## Releases` and before `## Later` (placement under Open questions):
- **108. Usage in the job record.** core. Depends on 11, 21, 51 (a decision).
- **109. Stats: the record.** stats; created with `arthur plugin new` (66). Depends on 108 and 23.
- **110. The merged-ticket report moves to stats.** stats, manage. Depends on 109, 61, 62, 63.
- **111. `arthur stats`, `/stats`, the morning report's Spend.** stats, orchestration (its procedure file and its eval). Depends on 110 and 65.
- **112. Usage windows beside the costs.** stats, models. Depends on 111 and 82.

Existing entries that change: 61 notes the move to 110; 77 gains the Spend screen; 85 gains the session name for the stats extension; the coverage row M2 reads `61; 110`.

**7. Worker tickets, each one pull request:**
1. Roadmap entries 108 to 112, the edits to 61, 77, 85 and M2, and the vision's plugin table: a `stats` row, and "stats" removed from manage's row (`spec/vision.md:85`). Docs only.
2. Entry 108.
3. Entry 109.
4. Entry 110: a pure move. `arthur stats` prints exactly what it prints today.
5. Entry 111: bare `arthur stats` becomes the spend view, and the report moves under `tickets`.
6. Entry 112.

## Not available directly
- **The share of a Claude usage window that each role used.** omp's report gives one used fraction per window for the whole account (`omp usage --json`: `amount.usedFraction`, `window.durationMs`, `resetsAt`). Nothing per session or per call, and nothing in a message's `usage` (I read the fields of a job's session file). The models plugin also drops `durationMs` (`packages/models/src/usage.ts:31-34`).
  - Option 1: no window figures; stats shows cost at list price only, beside `arthur usage`. Cost: none. Risk: on a subscription, the window is the real limit and the dollars are notional.
  - Option 2: an estimate. Each role's share of Arthur's list-price spend inside the window's span, shown next to the window's percent, marked `≈` and as an upper bound, with a new `models.windows` provide. Cost: about 10 models lines and about 50 stats lines. Risk: the owner's own use of the account outside Arthur is in the window but not in stats.
  - Option 3: sample the used fraction at each turn and run end, and give each difference to whatever ran in between. Cost: about 60 lines and a fetch every minute. Risk: jobs and the coordinator run at once, so a difference cannot be split; it looks exact and is not.
  - Recommendation: Option 2.
- **The coordinator's spend before stats is installed.** It exists only in omp's session files under `~/.omp/agent/sessions/`, in omp's internal format, outside Arthur's home.
  - Option 1: count from installation on. Cost: none. Risk: the first days of the views miss the coordinator's history.
  - Option 2: a one-off import of those files. Cost: about 40 lines that are thrown away after use. Risk: tied to omp's format, and it double counts if run after the extension has started.
  - Recommendation: Option 1. Job history comes from the backfill of the records that still exist (Approach §2).

## Files
- `spec/features/AR0480-plan-a-stats-plugin-token-use-cost-and-time-of-every-job-and-of-the-coordinator/plan.md`: this plan, filed with `arthur ticket file`. Nothing else changes in this ticket.
- Worker ticket 1 (roadmap):
  - `spec/roadmap.md`: the section `## Stats` with 108 to 112, and the edits to 61, 77, 85 and the M2 row;
  - `spec/vision.md`: the plugin table.
- Worker ticket 2 (108):
  - `packages/core/src/agent-stream.ts`: the message event also carries input, output, cacheRead and cacheWrite, and `provider/model`;
  - `packages/core/src/run-record.ts`: keeps and saves `usage`, starting from what the record holds;
  - `packages/core/src/wrapper.ts`: reads the earlier `usage`, as it reads `cost`. It counts 217 lines today (yellow), so if it would pass 220, the reading moves into `run-record.ts`;
  - `packages/core/src/job-records.ts`: `JobRecord.usage`, where a missing or broken file is `{}`;
  - `packages/core/src/machine-sync.ts`: `usage` in `RUN`;
  - `packages/core/src/fake-agent.ts`: a token option on a message step;
  - `docs/plugin-api.md`; `packages/core/docs/commands/spawn.md` (the record's files, the copy); `packages/core/docs/commands/jobs.md` (`host.jobs.list()`);
  - `test/structure.test.ts`: the core and core/testing budgets.
- Worker ticket 3 (109):
  - `packages/stats/`, made by `arthur plugin new stats --budget <owner's number>`: `src/stats.ts` (the plugin: the `job-ended` writer, the queue until `start`, the backfill, its `coordinator.extension` answer) and `src/session-extension.ts` (the turn lines);
  - `packages/stats/docs/stats.md`;
  - `arthur.config.example.ts` and `docs/setup.md`: `stats()`;
  - `docs/plugin-api.md`: stats as a provider of `coordinator.extension`;
  - `packages/orchestration/docs/commands/coordinator.md`: names the stats extension.
- Worker ticket 4 (110):
  - `packages/manage/src/stats.ts` → `packages/stats/src/tickets.ts`, and `packages/manage/test/stats.test.ts` → `packages/stats/test/`;
  - `packages/manage/docs/commands/stats.md` → `packages/stats/docs/commands/stats.md`;
  - `packages/manage/src/manage.ts`: the command is removed;
  - `packages/manage/src/audit.ts` and `retro.ts`: `collect("stats.tickets")`, and `mergedSince` stays in manage;
  - `packages/manage/docs/manage.md`;
  - `docs/plugin-api.md`: `stats.tickets`;
  - `test/structure.test.ts`: manage's budget down, stats' up.
- Worker ticket 5 (111):
  - `packages/stats/src/` (a reader with the filters, and the views), `packages/stats/docs/commands/stats.md`;
  - `packages/orchestration/roles/coordinator/morning-report.md`: the Spend section;
  - `packages/orchestration/evals/morning-report/scenario.json`: a stub for `^arthur stats`, and the Spend line expected in the reply.
- Worker ticket 6 (112):
  - `packages/models/src/usage.ts`: keeps `durationMs`;
  - `packages/models/src/models.ts`: `provide("models.windows")`;
  - `packages/stats/src/`: `arthur stats windows`;
  - `packages/models/docs/models.md`, `docs/plugin-api.md`.

## Risks
- **This ticket breaking the build:** it writes only `plan.md`. `npm run check` and `npm test` pass at HEAD.
- **Counting a run twice:** lines are skipped by `seq`, numbers are deltas against the job's earlier lines, and a coordinator line counts only messages after the last `until`.
- **Two writers:** runs are written only after `start` in `arthur run`, and each session file has one omp writing it.
- **`agent_end` messages:** I did not confirm whether they hold only the turn or the whole conversation. The `until` timestamp makes both safe. omp 18.3.0 lists `message_end` among its agent events (in the binary), but I did not confirm that extensions receive it, so the plan does not use it.
- **Lost lines:** a record gone before it is read becomes a `missing` line, counted as unknown and never dropped.
- **The name clash on `arthur stats`:** 110 moves the report before 111 changes what bare `arthur stats` prints. audit and retro keep their `### Stats` section, or say plainly that the plugin is not loaded.
- **Cost read as money paid:** every view says "at list price", and the window figures are marked `≈` and "at most".
- **Budgets:** core, core/testing, manage and models are each exactly at budget (measured), so every raise is named as a decision in its ticket. `wrapper.ts` is yellow at 217.
- **Privacy:** lines hold numbers, ids, kinds and model names, never text. The folder stays outside Git.

## How to test
- "`plan.md` with options and a recommendation for each" is checked by reading the plan:

| Done means sub-point | Where |
| --- | --- |
| Source (job, coordinator and project agent, another machine, Ollama) | Approach §1 |
| Record (file, fields, survives prune and restart, pruned jobs) | Approach §2 |
| Plugin (new or manage, budget, core interface) | Approach §3 |
| Views (`arthur stats` filters, `/stats`, morning report, web panel) | Approach §4 |
| Claude usage windows | Approach §5, Not available directly |
| Roadmap (entries, numbers, dependencies) | Approach §6, §7 |

- "No code; `npm test` and `npm run check` pass": run at HEAD in this checkout. `tsc` is clean; 1583 tests, 1519 pass, 0 fail, 64 skipped.
- For the worker tickets:
  - **108:** a wrapper test with the fake agent's tokens over two runs (`continue`), checking that `usage` is cumulative; a broken `usage` file reads as `{}`; a job on another machine has its `usage` copied (`machine.test.ts`).
  - **109:** against the fake host:
    - a `job-ended` before `start` is written at `start`;
    - in a process that never starts, nothing is written;
    - a replayed `seq` is skipped;
    - a second end of the same run adds 0;
    - a record that is gone gives a `missing` line;
    - the backfill happens once;
    - the extension with the fake agent writes one line per turn and counts nothing twice across a resume and a restart.
  - **110:** the moved test passes unchanged; audit and retro get the section, or the "not loaded" line.
  - **111:** each filter, each limit of `--since`, an empty folder, an unparsed line, the in-job refusal, `/stats`; the morning report eval.
  - **112:** a window with a span, without `resetsAt`, and with no report.

## Open questions
- Where should entries 108 to 112 go in the order: in a new `## Stats` section after Releases (first version), or under Later? I recommend after Releases. It only reads, and it needs no channel or outside service.
- The first line budget of the new `stats` package is yours to set: I propose 200 at 109, raised by about 120, 200 and 50 in 110 to 112.
- Should the window estimate (112) be built at all, or should stats show list-price cost only (Option 1)? I recommend building it, marked `≈`.