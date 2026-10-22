# resources

The `resources` plugin: what one job may use of a machine's CPU and memory (roadmap entry 32), what all jobs of one ticket may spend and use together (entry 33), how many jobs each machine has room for, from its free CPU and memory (entry 34), and the free disk each machine keeps (entry 69). A job's own time and money stay the core's (`core.jobs.timeoutMinutes`, `core.jobs.budgetUsd`), and so does the joint slice of all jobs (`core.jobs.cpu`, `core.jobs.memory`), which keeps them from starving the coordinator.

## Options

In `resources({ ... })` in `arthur.config.ts`; every key optional, a cap left out is none:

| Option | Meaning |
| --- | --- |
| `perJob.cpu` | The cores one job may use, a number above 0 such as `2` or `0.5`: the `CPUQuota` of its own scope. A job over it is slowed, not stopped. On a machine with fewer cores it is that machine's cores. |
| `perJob.memory` | The memory one job may use, in systemd `MemoryMax` syntax: bytes with K, M, G or T (`4G`), a percentage of the machine's memory (`25%`), or `infinity`. A job over it ends `limit: memory`. |
| `perFeature.budgetUsd` | The USD all jobs of one ticket may cost together, a number of 0 or more, `0` for no cap. |
| `perFeature.hours` | The hours all jobs of one ticket may run together, a number of 0 or more, `0` for no cap. |
| `perFeature.cpu` | The cores all jobs of one ticket share, the `CPUQuota` of the ticket's slice, `0` for no cap. |
| `perFeature.memory` | The memory all jobs of one ticket share, the `MemoryMax` of the ticket's slice, with `MemorySwapMax=0` so swap does not stretch it, in `perJob.memory`'s syntax, `0` for no cap. Over it the kernel kills a process of one of its jobs, which ends `limit: memory: the jobs of ticket <id> went over their memory cap of <memory>`. |
| `keepFree.cpu` | The cores left free on every machine, for the coordinator and the system: a number of 0 or more, default 0. |
| `keepFree.memory` | The memory left free on every machine: bytes with K, M, G or T (`2G`) or a percentage of the machine's memory (`10%`), default none. |
| `keepFree.disk` | The disk left free on each filesystem a machine's jobs write: bytes with K, M, G or T (`20G`), default `0`, no floor ("Free disk"). |

The plugin answers `jobs.limits` with them for every job, and the core sets them on the job's own scope inside the joint slice, on this host and on every other machine; where a machine has no user manager (macOS), the job's memory is sampled every 10 seconds instead and its CPU is not capped, which a `notice` says once per machine. See "Caps per job" in `arthur spawn --help`.

Refused at load (and by `arthur config check`), naming the option: a cap above the joint limit of all jobs together as this host's config sets it, `perJob.cpu: <cpu> is above core.jobs.cpu, <cores>, the cores of all jobs together` and `perJob.memory: <memory> is above core.jobs.memory, <memory>, the memory of all jobs together` (a percentage counted of this host's memory); a value of the wrong kind (`keepFree.memory` `infinity` too); an option or key it does not take. With the plugin off (`enabled: false`) or not listed, the joint slice is a job's only limit, and every machine takes jobs up to `maxAgents`.

## Caps per feature

A job belongs to the ticket its first `Ticket:` path lies in (`spec/features/<id>-<slug>/`): worker, reviews and plans alike; a job without one is held by the per-job caps only. Each `perFeature` cap is replaced by the same key of `caps` in the ticket's JSON block, `"caps": { "budgetUsd": 40, "hours": 12 }`, read from its `ticket.md` in the project's main checkout as the human edits it (with the `projects` plugin; without it, `perFeature` alone), `0` meaning no cap. A block that is not JSON, or `caps` of the wrong shape, refuses the spawn naming the file.

- Spend: `budgetUsd` is the sum of the jobs' `cost`, a job whose `cost` is missing or broken counting as its whole `budget` (with no budget, as unknown, which reaches every cap); `hours` the sum of the time each job spent in a run (the core's `ran`), one in a run counted up to now. A spend exactly at a cap reaches it: USD at 4 decimals, time to the second.
- Spawn: through `beforeSpawn`, also for `arthur continue`, a spawn for a ticket at its money or time cap is refused: `refused by resources: <id>: feature cap budgetUsd reached: $<spent> of $<cap>; raise "caps" in its ticket's JSON block, or perFeature.budgetUsd` (or `feature cap hours reached: <spent> h of <cap> h`).
- Running jobs: while `arthur run` runs, every 10 seconds, the jobs in a run of a ticket at a cap are stopped through `host.jobs.block(id, reason, true)` and held `blocked` on `user: feature cap <what> reached: <spent> of <cap>`, so `arthur continue` resumes one once the human raised the cap. The event `cap-reached` is emitted once per stop, `{ ticket, project, cap, spent, limit, reason, jobs }` (`cap` `budgetUsd` or `hours`, `spent` and `limit` in USD or hours, `jobs` the ids stopped); a job it stopped already is not stopped again.
- CPU and memory: a ticket with a `cpu` or `memory` cap puts each of its jobs in the slice `<jobs' slice>-<id>.slice` inside the jobs' slice, on each machine, whose `CPUQuota` (at most the machine's cores) and `MemoryMax` are set at each launch from the caps in force at the job's spawn or its `arthur continue`. Without a user manager (macOS) they are not held, which the `notice` of a machine that runs jobs bare says, once per machine.

`arthur resources <ticket>` shows the spend against each cap: `arthur resources --help`.

## How many jobs run

Each machine's room for more jobs comes from its free CPU and memory, so the coordinator starts only as many as the machines hold; `maxAgents` of `orchestration` stays the upper bound across them all.

- The check: `arthur run` checks `local` at its start and every 60 seconds, and each machine of the `machines` plugin's list at each of that plugin's checks (its `check.everySeconds`, and `arthur machines` or `arthur doctor` when asked), whose one ssh call carries the numbers, so the reading is never older than the machine's own check: the plugin provides `machines.round`, which the `machines` plugin collects as each round begins; a spawn or `arthur resources` waits for a check of the machine in flight, a round's included, and checks a machine again whose last check is missing, or as old as twice the `check.everySeconds` of the round that made it (2 minutes for a check of its own), so a spawn between rounds makes no ssh call of its own. On `local` it reads Node's `os`: `availableParallelism()` cores, the cores in use (the CPU time `cpus()` counts as user, nice, sys and irq on all cores over one second, per second of it), `freemem()` and `totalmem()`; on another machine the same through `node -e`, in the `machines` plugin's check or, when a spawn or `arthur resources` checks it again, over the core's SSH, cut after 10 seconds. Free cores are the cores less those in use (none when more are in use). A process waiting on disk uses no CPU time, so it takes no core, though Linux's load average counts it. Each check is kept in `.arthur/resources/machines/<name>.json` with the jobs in a run on the machine as it began, so every process reads the same one.
- The room: what is free, less `keepFree`, less the reservation of each job in a run on the machine that the check did not see (started since), in whole reservations. A job reserves its `perJob` caps: `cpu` (at most the machine's cores) and `memory` (a percentage of that machine's memory; `infinity` reserves none). A reservation exactly equal to what is left fits. Without `perJob` a job reserves nothing, and a machine has room for any number while it keeps `keepFree`.
- A machine whose check fails (ssh refused, `node` missing there, numbers it did not answer, 10 seconds without an answer, or offline in the `machines` plugin's check, with its reason; with a disk floor also its `df`, below) has no room. It is said once, as a `notice`, `machine <name>: its room is unknown (<reason>); no job starts there until a check answers`, and again only after a check that answered. Once also across processes: a check reads the one before it and writes its own under a lock on the machine's file (`machines/<name>.json.lock`), so of two checking the machine at once (`arthur run` and an `arthur spawn`) the second reads the first's.
- Placement: the plugin answers `resources.free` with a machine's name, the number of jobs it has room for, which the `machines` plugin's placement reads to pick the machine with the most (`arthur machines --help`, "Placing a job").
- Spawn: through `beforeSpawn`, also for `arthur continue`, a job starts only on a machine with room for it. Spawns take the core's spawn lock in turn, so two at once never both take the last room: the second counts the first at its reservation. Refused, naming every machine and its room: `refused by resources: no room on <machine> for another job: <one line per machine, joined by "; ">; spawn again once a job ends`. As at `maxAgents`, the coordinator spawns again when a job ends.
- The coordinator's context gets one line per machine through `collect("coordinator.context")`, read from the checks kept, without checking anew; `arthur resources` and `/resources` show the same lines (`arthur resources --help`):

```
local: room for 2 more jobs (5.1 GB, 3.4 cores, 41 GB disk free)
mac: no room, short of 1.2 GB memory (4.8 GB, 6.0 cores, 88 GB disk free; keepFree 2.0 GB, 1.0 cores, 20 GB disk; a job reserves 4.0 GB, 2.0 cores; reserved for 1 job started since the check)
build: no room, 12.3 GB free on /var/lib/docker, floor 20 GB
gpu: no room, its check failed: ssh failed: ssh: connect to host gpu port 22: Connection refused
```

The free memory and cores a line shows are what the check found less the reservations of the jobs started since; GB are 2^30 bytes. A machine not checked yet: `<name>: no room, not checked yet`.

## Free disk

With `keepFree.disk` above 0, a machine takes no job while the least free filesystem its jobs write holds less than the floor; the jobs already running there finish in the reserve the floor keeps.

- The filesystems: the machine's `home` (Arthur's folder there, `host.jobs.home`), and each path another plugin names for it through `collect("resources.disk", machine)`, an absolute path or a list of them (docker: its data root, roadmap entry 70). Two paths on one filesystem count once, under the first named, the home first. A machine without such a plugin counts its home only.
- The check: at every check of the machine above, after its CPU and memory answered, one `sh -c` there runs `df -Pk` on each path, and the free space is df's `Available` column, KiB of 1024 bytes. In a round of the `machines` plugin, the plugin's answer to `machines.round` names each machine's paths, and that plugin's check runs the df in its own one ssh call, so the round costs one ssh call per machine; a check of its own runs it on `local` here, on another machine over the core's SSH, cut after 10 seconds. With the floor `0` or left out, no `df` runs and the lines show no disk.
- A path a plugin named that is not on the machine is skipped, said on a line of its own after the machine's, `<name>: skipped <path>, not there`; the home still counts. A home that is not there, a provider's answer that is no absolute path, `df` failing, or output that is no POSIX `df -P` (one line per path) fails the whole check, with no room, said once as above: `df -Pk failed there: <its last line>`, `df -Pk answered "<what>", not POSIX df -P output`, `its home <path> is not there`, `resources.disk answered <value>, not an absolute path`.
- The room: free space exactly at the floor takes jobs; under it by a KiB the machine has none, `<name>: no room, <free> GB free on <path>, floor <floor> GB` (GB of 2^30 bytes, cut to one decimal), in the context, `arthur resources` and a spawn's refusal, and `resources.free` answers 0, so the `machines` plugin's placement takes another machine with the labels. A check kept without the floor's disk, from before it was set, is `<name>: no room, its free disk not checked yet` until the next one.
- Falling under it: the first check under the floor after one that was not (or after none, or a failed one) emits `disk-low`, `{ machine, path, free, floor }` (bytes, `path` the least free filesystem's), and one `notice`, `machine <name>: <free> GB free on <path>, floor <floor> GB; no job starts there until it is back at the floor, the running ones go on`, once also across processes, as above. The checks that stay under emit nothing more; free space back at the floor and under it again is a new fall. Running jobs are never stopped for disk: they finish in the reserve the floor keeps.
