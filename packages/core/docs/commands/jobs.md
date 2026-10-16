# arthur jobs

Usage: `arthur jobs`; on a channel `/jobs`.

Every project's jobs, from their records in `<home>/jobs/`, answered without the model; `no jobs` when there is none. Three groups, each under its heading and newest spawn first: `running` (a record still without a `state` shows `starting`), `needs attention` (`failed`, `stopped`, `limit: time`, `limit: budget`) and `done`. One line per job:

```
AR0018  worker  running  1h15m  $0.40/$2.00  acme  436045b4
```

- The ticket: the first `Ticket:` path of the task that lies in `spec/features/<id>-<slug>/`, else `-`.
- The kind and the state.
- A running job: how long since its state was written (its start, or its last `arthur continue`); an ended one: the time it ended in `timeZone` when that was today, else its date.
- Its cost against its budget, in USD; `$0.00/$0.00` is a job without a budget.
- Its project, when the records hold jobs of more than one project.
- Its short id, the 8 hex digits that end its id. `arthur stop`, `steer`, `continue`, `prune` and `/steer` take it in place of the full id; a short id that matches two jobs is refused, naming both.

Refused: a config or a plugin that does not load (`arthur.config.ts did not load:`, then the reasons), exit code 1; on a channel the reply is `/jobs failed: <reason>`. Any argument in the shell prints the usage line and exits 2.
