# The stats plugin

Roadmap entry 109: Arthur keeps the tokens, cost and time of every job run and of every coordinator turn, in two append-only files of its own folder, `<home>/stats/`. It calls no model. Every cost is omp's at list price, what the tokens would cost on the API, not money paid on a subscription.

Roadmap entry 111: the views of these files. `arthur stats` prints the spend of a span, the last 7 days by default, by role, project, model, day and ticket, with filters; `/stats` answers its total, by role and top 3 tickets on a channel; the morning report's Spend section is the first two lines of `arthur stats --since 1d` (`arthur stats --help`).

Roadmap entry 110: the merged tickets' report, which came with manage (61), is this plugin's: `arthur stats tickets` prints it (`arthur stats tickets --help`), and the provided name `stats.tickets`, `(project, since?)` to the same report of the tickets merged at `since` or later, gives manage's audit and retro prompts their `### Stats` section (`packages/manage/docs/manage.md`).

Roadmap entry 112: `arthur stats windows` puts each usage window of the account, which the models plugin reads from the agent's report and gives as `models.windows`, beside what Arthur spent at list price on that provider's models in the window's span, by role, each role's part of the window an estimate marked `≈` and an upper bound, since the account's use outside Arthur counts in the window too (`arthur stats windows --help`). Without the models plugin it says so in one line.

```ts
plugins: [orchestration({}), stats()],
```

It has no options but `enabled`; any other is refused at load (`stats.<key>: unknown option; stats has no options but enabled`).

## Job runs: `runs.jsonl`

One line per `job-ended`, what that run added to the job's record (`arthur jobs --help`, the record's `cost`, `usage` and `ran`):

```json
{"seq":812,"time":"2026-11-06T10:42:07.120Z","job":"2026-11-06-worker-0a1b2c3d","kind":"worker","project":"acme","tickets":["AC0012"],"machine":"local","state":"ended","reason":"finished","seconds":1260.5,"cost":3.4215,"usage":{"anthropic/claude-opus-5-5":{"messages":41,"input":120,"output":18200,"cacheRead":2100000,"cacheWrite":95000,"cost":3.4215}}}
```

- `seq` and `time` are the event's; `tickets` the ids of the tickets its task names on `Ticket:`; `seconds` the time in the run, `cost` USD, `usage` per `<provider>/<model>` its messages, tokens and USD. A local model's tokens come with a cost of 0.
- Each number is the record's total now less the job's earlier lines: a continued job's second run counts what it added, on the day it ran, and a second end of the same run (blocked, then stopped) adds 0.
- Only `arthur run` writes, once its plugins started. An end heard before (the replay of the event log at the start) waits for the start; a command's process (`arthur stop`) hears its own `job-ended` and writes nothing. An end whose `seq` is not above the highest one written is skipped, so a replay after a crash writes nothing twice.
- A job whose record is already gone when its end is read (pruned while `arthur run` was down) gets a line with `"missing": true`, its numbers 0: unknown, not free.
- The first start, with no `runs.jsonl` yet, writes one `"backfill": true` line, without `seq`, its `time` the record's `since`, for every record `arthur jobs` still holds whose run is over: its cost, seconds and tokens, the tokens only when its record has `usage` (entry 108). A job then in a run gets its whole spend at its end. A job pruned before is not counted.

## Coordinator turns: `sessions/<session>.jsonl`

The plugin gives orchestration an OMP extension, `packages/stats/src/session-extension.ts`, which the coordinator's agent loads (`arthur coordinator --help`, `coordinator.extension`) with `ARTHUR_STATS_FOLDER` naming the plugin's folder. At each real end of a turn (`agent_end` that does not go on) it appends one line to `sessions/coordinator.jsonl`:

```json
{"time":"2026-11-06T10:45:00.000Z","session":"coordinator","seconds":38.2,"until":1794480299512,"cost":0.8125,"usage":{"anthropic/claude-opus-5-5":{"messages":3,"input":9,"output":1400,"cacheRead":310000,"cacheWrite":4200,"cost":0.8125}}}
```

- The numbers are those of the assistant messages whose `timestamp` is after `until`, the last one counted, which the line keeps; at its start the extension reads it from the file's last line without `sub`. So a turn that goes on after its `agent_end` (`willContinue`) is counted once at its real end, and a restarted coordinator (`--continue`) counts none of the conversation it already counted.
- `seconds` runs from the turn's first `agent_start`.
- A session without a UI, a `task` subagent, writes its turns to the same file marked `"sub": true` [INFERENCE: omp loads the coordinator's extensions into its subagents, as the other extensions' `hasUI` guards assume].
- The coordinator's spend before the plugin is installed is not imported. A project agent (roadmap 85) gets its own session name then; until then every session is `coordinator`.

## The files

- Each line is one append ending in a line break. A last line a crash cut gets its line break before the next one, and a reader skips a line it cannot parse.
- Each file has one writer: `runs.jsonl` the one `arthur run` of the home, a session's file that session's single omp.
- Lines hold numbers, ids, kinds and model names, never text. The folder is outside Git, and `arthur prune` leaves it alone; the files are kept for ever.
- omp's own side calls (its compaction, the `--smol` model) count only when they come as assistant messages, as for a job's `cost`.
