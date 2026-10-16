# arthur jobs

Usage: `arthur jobs [--state <state>]`; on a channel `/jobs`.

Every project's jobs, from their records in `<home>/jobs/`, answered without the model; `no jobs` when there is none. One group per state, under its heading, in this order, each newest spawn first: `blocked`, `working`, `idle`, `ended`. One line per job:

```
AR0018  worker  blocked  1h15m  $0.40/$2.00  acme  436045b4  user: may I drop the old table?
```

- The ticket: the first `Ticket:` path of the task that lies in `spec/features/<id>-<slug>/`, else `-`.
- The kind and the state.
- A job that has not ended: how long it has been in its state (since `since`); an ended one: the time it ended in `timeZone` when that was today, else its date.
- Its cost against its budget, in USD; `$0.00/$0.00` is a job without a budget.
- Its project, when the records hold jobs of more than one project.
- Its short id, the 8 hex digits that end its id. `arthur stop`, `steer`, `continue`, `prune` and `/steer` take it in place of the full id; a short id that matches two jobs is refused, naming both.
- Its reason, when it has one.

`--state <state>` shows only the jobs in that state, `no <state> jobs` when there is none.

## States

Every job is in one of four states, kept in its record as `state`, with `reason` and `since` (the ISO time it took that state); `reason` and `since` are written first and `state` last. Each change, of the state or of its reason, emits `job-state` with `id`, `project`, `ticket` (the ticket id of the task's first `Ticket:` path in `spec/features/`, else `null`), `machine` (`local`, or the machine the job runs on; see `arthur spawn --help`), `from`, `to` and `reason`; a move to the state and reason the job is in already writes and emits nothing. A spawn writes the record `working`, with no event (`job-started` is the first).

- `working`: the agent is in a run, with output (any line on its stdout or stderr) or a tool call within the last `core.jobs.idleMinutes` (default 10). No reason.
- `idle`: its run goes on, but its agent has printed nothing for `core.jobs.idleMinutes`; its next output, a tool call for example, turns it `working` again with one event. `0` turns idle off. No reason.
- `blocked`: it cannot go on until something outside it happens; the reason says what, `user: <question>` or `dependency: <what>`. A run that would end `finished` ends `blocked` when the first line of the agent's final message is `Blocked: user <question>` (reason `user: <question>`) or `Blocked: on <ticket or job id>` (reason `dependency: <ticket or job id>`); the line anywhere else ends it `finished`. A plugin holds a job in a run with `host.jobs.block(id, reason)`: `blocked` on `dependency: <reason>` (its spaces and line breaks made one space), whatever its agent does, until `host.jobs.unblock(id)`, which returns it to `working`, or to `idle` when its agent printed nothing for its `idleMinutes`; `unblock` of a job no plugin holds does nothing. `block` is refused for an empty reason (`block <id>: the reason is empty`), an id with no record (`<id>: no such job in <home>/jobs`) and a job not in a run (`block <id>: it is <state> (<reason>), not in a run; only a job in a run is held`). The end of a run ends the hold.
- `ended`: nothing more will happen. The reason is the outcome: `finished`, `stopped` (by `arthur stop`), `limit: time: ...`, `limit: budget: ...`, or `failed: <why>`, `failed: process gone` among them (see `arthur spawn --help`).

`arthur continue` moves a job that is `blocked` at the end of its run, or `ended`, back to `working` and clears its reason. A job is in a run while it is `working` or `idle`, or held by a plugin: `arthur stop`, `steer` and `stopall` reach only those, `arthur continue` none of them. The sweep of `arthur run` ends a `working` or `idle` job whose wrapper and agent were gone on two sweeps in a row, never a `blocked` one nor one on another machine, whose record the sweep copies from there instead. `arthur prune` frees only an `ended` job.

The record also holds `hold` (the reason of a plugin's block, while it holds the job), `active` (its time is the agent's last output), `idle-minutes` (the job's `core.jobs.idleMinutes`) and `state.lock` (held for a moment by each change).

Refused: a config or a plugin that does not load (`arthur.config.ts did not load:`, then the reasons), exit code 1; on a channel the reply is `/jobs failed: <reason>`. Any argument in the shell, an unknown flag, or `--state` without one of `blocked`, `working`, `idle`, `ended` prints the usage line and exits 2.
