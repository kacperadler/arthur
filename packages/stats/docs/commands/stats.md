# arthur stats

Usage: `arthur stats [--since today|yesterday|<n>d|YYYY-MM-DD] [--project <name>] [--role <role>] [--ticket <id>] [--model <provider/model>]`, or `arthur stats tickets [--project <name>]`. Comes with the `stats` plugin (roadmap entry 111). Answered without the model, from the plugin's own files, `<home>/stats/runs.jsonl` and `<home>/stats/sessions/*.jsonl` (`packages/stats/docs/stats.md`); it reads only. Every cost is omp's at list price, what the tokens would cost on the API, not money paid on a subscription.

`arthur stats tickets` is the merged tickets' report of one project, which bare `arthur stats` printed before entry 111: `arthur stats tickets --help`.

## The spend

By default the last 7 days of every project:

```
Spend since 2026-11-06 11:00 (7 days), every project: $17.00 at list price, 6 runs (2 failed or stopped), 1 turn, 0h35m
Tokens: 202 in, 2.6K out, 1.2M cache read, 50K cache write
By role:
- worker: $9.00 (53%), 3 runs (1 failed or stopped)
- coordinator: $4.50 (26%), 1 turn
- review: $2.00 (12%), 1 run (0 failed or stopped)
- audit: $1.00 (6%), 1 run (1 failed or stopped)
- plan: $0.50 (3%), 1 run (0 failed or stopped)
By project:
- acme: $11.00 (65%), 4 runs (1 failed or stopped)
- no project: $4.50 (26%), 1 turn
- other: $1.50 (9%), 2 runs (1 failed or stopped)
By model:
- anthropic/claude-opus-5-5: $16.00 (94%), 162 in, 2.6K out, 1.2M cache read, 50K cache write
- not recorded: $1.00 (6%), 0 in, 0 out, 0 cache read, 0 cache write
- ollama/qwen: $0.00 (0%), free, 40 in, 4 out, 0 cache read, 0 cache write
By day:
- 2026-11-10: $1.00 (6%), 1 run (1 failed or stopped)
- 2026-11-11: $3.00 (18%), 1 run (1 failed or stopped)
- 2026-11-12: $13.00 (76%), 4 runs (0 failed or stopped), 1 turn
Most expensive tickets:
- AC0012 (merged): $8.00: worker $6.00, review $2.00
- AC0013 (dropped): $1.50: worker $1.50
- AC0014 (in-progress): $1.50: worker $1.50
- OT0001 (status unknown): $0.50: plan $0.50
Whether it pays:
- on 1 ticket merged since 2026-11-06 11:00 (7 days): $8.00, $8.00 per ticket
- on dropped tickets: $1.50
- on runs that failed or were stopped: $4.00 in 2 runs
- on work with no ticket (the coordinator, audits): $5.50
Unknown: 1 run whose record was gone, 2 lines not read
```

- The first two lines are the total: cost, the job runs and how many of them failed or were stopped, the coordinator's turns, the time, then the tokens. The morning report's Spend section is these two lines of `arthur stats --since 1d`.
- A run is one line of `runs.jsonl`: what one run of a job added to its record. A turn is one line of a session's file; a subagent's turn (`sub`) adds its cost and tokens to its session's but is no turn of its own, and its time is inside its session's.
- A run's role is its job's kind (`worker`, `review`, `plan`, `audit`, ...), a turn's its session's name (`coordinator`). A run failed or was stopped when its reason starts with `failed`, `stopped` or `limit:` (`arthur spawn --help`).
- By role, project and model, the most expensive first, each with its share of the total; by day in order, the day in `core.timeZone`. A turn has no project (`no project`). A model whose cost is 0 is marked `free`, its tokens still counted (a local model); `not recorded` is the cost of runs whose record had no `usage` (a backfill line of a record older than roadmap entry 108).
- Most expensive tickets: the 5 with the highest cost, each split by role, with its board status, `status unknown` when no board of the project list holds it or its board cannot be read. A run that names several tickets gives each an equal share.
- Whether it pays: the spend on the tickets the board shows merged with their last move in the span, and per such ticket; on tickets the board shows dropped; on the runs that failed or were stopped; on the runs and turns that name no ticket.
- Unknown: the runs whose record was gone when they ended (`"missing": true`, numbers unknown, never counted as free), and the lines that are no JSON object or have no time it can read (cut by a crash, edited by hand), which nothing else counts.

With nothing in the span, one line: `No job run or coordinator turn since <when>, <scope>.`, and the Unknown line under it when a line was not read.

## Filters

- `--since`: `today` and `yesterday` from that local day's start in `core.timeZone`; `<n>d`, the last n times 24 hours, n from 1 to 99999 (`--since 1d` the last 24 hours); `YYYY-MM-DD`, a real date, from that local day's start. 7 days when left out.
- `--project <name>`: only that project's runs; for this command it narrows, where other commands switch to that project. Turns have none, so they are left out.
- `--role <role>`: only that kind's runs, or that session's turns.
- `--model <provider/model>`: only that model's share of each run and turn, its cost and tokens; a line with nothing of it is left out.
- `--ticket <id>`: that ticket's runs instead, one per line, the oldest first, under one line of their total:

```
Runs of AC0013 since 2026-11-06 11:00 (7 days), every project: $1.50 at list price, 1 run
- 2026-11-11 09:00 worker, anthropic/claude-opus-5-5+ollama/qwen, ended: failed: no verdict, $1.50 (its share of $3.00, 2 tickets), 50 in, 104 out, 0 cache read, 0 cache write, 0h10m
```

The filters combine; each narrows every section, the total too.

## /stats

`/stats [today|yesterday|<n>d|YYYY-MM-DD] [<ticket id>]`, in either order, on a channel: answered without the model, every project, the last 7 days by default. Without a ticket, the total, by role and the 3 most expensive tickets; with one, its runs as `--ticket` prints them. Any other words reply `usage: /stats [today|yesterday|<n>d|YYYY-MM-DD] [<ticket id>]`.

## Refused

- Wrong usage (an unknown flag, a word after `stats` but `tickets`, a flag without its value, a `--since` none of the above) prints the usage line and exits 2.
- Inside a job (`arthur help --help`), Arthur's home is hidden from the job's sandbox, the plugin's folder with it: `arthur stats` prints `arthur stats: the spend is kept in Arthur's home, which a job cannot read; arthur stats tickets runs here` and exits 1, and `/stats` replies the same, without the prefix. `arthur stats tickets` runs there, as before.
