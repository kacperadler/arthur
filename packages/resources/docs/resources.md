# resources

The `resources` plugin: what one job may use of a machine's CPU and memory (roadmap entry 32), and what all jobs of one ticket may spend and use together (entry 33). A job's own time and money stay the core's (`core.jobs.timeoutMinutes`, `core.jobs.budgetUsd`), and so does the joint slice of all jobs (`core.jobs.cpu`, `core.jobs.memory`), which keeps them from starving the coordinator. How many jobs the free resources allow is roadmap entry 34.

## Options

In `resources({ ... })` in `arthur.config.ts`; every key optional, a cap left out is none:

| Option | Meaning |
| --- | --- |
| `perJob.cpu` | The cores one job may use, a number above 0 such as `2` or `0.5`: the `CPUQuota` of its own scope. A job over it is slowed, not stopped. On a machine with fewer cores it is that machine's cores. |
| `perJob.memory` | The memory one job may use, in systemd `MemoryMax` syntax: bytes with K, M, G or T (`4G`), a percentage of the machine's memory (`25%`), or `infinity`. A job over it ends `limit: memory`. |
| `perFeature.budgetUsd` | The USD all jobs of one ticket may cost together, a number of 0 or more, `0` for no cap. |
| `perFeature.hours` | The hours all jobs of one ticket may run together, a number of 0 or more, `0` for no cap. |
| `perFeature.cpu` | The cores all jobs of one ticket share, the `CPUQuota` of the ticket's slice, `0` for no cap. |
| `perFeature.memory` | The memory all jobs of one ticket share, the `MemoryMax` of the ticket's slice, in `perJob.memory`'s syntax, `0` for no cap. |

The plugin answers `jobs.limits` with them for every job, and the core sets them on the job's own scope inside the joint slice, on this host and on every other machine; where a machine has no user manager (macOS), the job's memory is sampled every 10 seconds instead and its CPU is not capped, which a `notice` says once per machine. See "Caps per job" in `arthur spawn --help`.

Refused at load (and by `arthur config check`), naming the option: a cap above the joint limit of all jobs together as this host's config sets it, `perJob.cpu: <cpu> is above core.jobs.cpu, <cores>, the cores of all jobs together` and `perJob.memory: <memory> is above core.jobs.memory, <memory>, the memory of all jobs together` (a percentage counted of this host's memory); a value of the wrong kind; an option or key it does not take. With the plugin off (`enabled: false`) or not listed, the joint slice is a job's only limit.

## Caps per feature

A job belongs to the ticket its first `Ticket:` path lies in (`spec/features/<id>-<slug>/`): worker, reviews and plans alike; a job without one is held by the per-job caps only. Each `perFeature` cap is replaced by the same key of `caps` in the ticket's JSON block, `"caps": { "budgetUsd": 40, "hours": 12 }`, read from its `ticket.md` in the project's main checkout as the human edits it (with the `projects` plugin; without it, `perFeature` alone), `0` meaning no cap. A block that is not JSON, or `caps` of the wrong shape, refuses the spawn naming the file.

- Spend: `budgetUsd` is the sum of the jobs' `cost`, a job whose `cost` is missing or broken counting as its whole `budget` (with no budget, as unknown, which reaches every cap); `hours` the sum of the time each job spent in a run (the core's `ran`), one in a run counted up to now. A spend exactly at a cap reaches it: USD at 4 decimals, time to the second.
- Spawn: through `beforeSpawn`, also for `arthur continue`, a spawn for a ticket at its money or time cap is refused: `refused by resources: <id>: feature cap budgetUsd reached: $<spent> of $<cap>; raise "caps" in its ticket's JSON block, or perFeature.budgetUsd` (or `feature cap hours reached: <spent> h of <cap> h`).
- Running jobs: while `arthur run` runs, every 10 seconds, the jobs in a run of a ticket at a cap are stopped through `host.jobs.block(id, reason, true)` and held `blocked` on `user: feature cap <what> reached: <spent> of <cap>`, so `arthur continue` resumes one once the human raised the cap. The event `cap-reached` is emitted once per stop, `{ ticket, project, cap, spent, limit, reason, jobs }` (`cap` `budgetUsd` or `hours`, `spent` and `limit` in USD or hours, `jobs` the ids stopped); a job it stopped already is not stopped again.
- CPU and memory: a ticket with a `cpu` or `memory` cap puts each of its jobs in the slice `<jobs' slice>-<id>.slice` inside the jobs' slice, on each machine, whose `CPUQuota` (at most the machine's cores) and `MemoryMax` are set at each launch from the caps the job's record kept at its spawn. Without a user manager (macOS) they are not held.

`arthur resources <ticket>` shows the spend against each cap: `arthur resources --help`.
