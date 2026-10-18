# resources

The `resources` plugin: what one job may use of a machine's CPU and memory (roadmap entry 32). A job's time and money stay the core's (`core.jobs.timeoutMinutes`, `core.jobs.budgetUsd`), and so does the joint slice of all jobs (`core.jobs.cpu`, `core.jobs.memory`), which keeps them from starving the coordinator. Caps per feature and how many jobs the free resources allow are roadmap entries 33 and 34.

## Options

In `resources({ ... })` in `arthur.config.ts`; every key optional, a cap left out is none:

| Option | Meaning |
| --- | --- |
| `perJob.cpu` | The cores one job may use, a number above 0 such as `2` or `0.5`: the `CPUQuota` of its own scope. A job over it is slowed, not stopped. On a machine with fewer cores it is that machine's cores. |
| `perJob.memory` | The memory one job may use, in systemd `MemoryMax` syntax: bytes with K, M, G or T (`4G`), a percentage of the machine's memory (`25%`), or `infinity`. A job over it ends `limit: memory`. |

The plugin answers `jobs.limits` with them for every job, and the core sets them on the job's own scope inside the joint slice, on this host and on every other machine; where a machine has no user manager (macOS), the job's memory is sampled every 10 seconds instead and its CPU is not capped, which a `notice` says once per machine. See "Caps per job" in `arthur spawn --help`.

Refused at load (and by `arthur config check`), naming the option: a cap above the joint limit of all jobs together as this host's config sets it, `perJob.cpu: <cpu> is above core.jobs.cpu, <cores>, the cores of all jobs together` and `perJob.memory: <memory> is above core.jobs.memory, <memory>, the memory of all jobs together` (a percentage counted of this host's memory); a value of the wrong kind; an option or key it does not take. With the plugin off (`enabled: false`) or not listed, the joint slice is a job's only limit.
