# arthur resources

Usage: `arthur resources [<ticket id>]`; on a channel `/resources`.

Without a ticket id, each machine's room for more jobs (roadmap entries 34 and 69), one line per machine, `local` first, then in the order the machines were registered, answered without the model; the shell, the channel and the coordinator's context get the same lines:

```
local: room for 2 more jobs (5.1 GB, 3.4 cores, 41 GB disk free)
mac: no room, short of 1.2 GB memory (4.8 GB, 6.0 cores, 88 GB disk free; keepFree 2.0 GB, 1.0 cores, 20 GB disk; a job reserves 4.0 GB, 2.0 cores; reserved for 1 job started since the check)
build: no room, 12.3 GB free on /var/lib/docker, floor 20 GB
build: skipped /srv/cache, not there
gpu: no room, its check failed: ssh failed: ssh: connect to host gpu port 22: Connection refused
```

- `room for <n> more jobs`: the whole `perJob` reservations that fit in what is free less `keepFree`; `room for any number of jobs, perJob reserving nothing` without `perJob`.
- `no room, short of ...`: how much more memory or how many more cores one more job needs, then what is free, `keepFree`, what a job reserves, and the jobs started since the check, each counted at its reservation.
- `<n> GB disk free`, with `keepFree.disk` above 0: the least free filesystem the machine's jobs write. `no room, <free> GB free on <path>, floor <floor> GB`: that filesystem under the floor. `skipped <path>, not there`: a path a plugin named that the machine lacks, on a line of its own.
- `no room, its check failed: <reason>`, `no room, not checked yet` and `no room, its free disk not checked yet`: a machine with no numbers takes no job.
- The free memory and cores are those of the machine's last check, less the reservations of the jobs started since. A check 2 minutes old or more, or missing, is made again first; how a machine is checked: `docs/resources.md` of the `resources` plugin, "How many jobs run" and "Free disk".

With a ticket id, what all jobs of that ticket (worker, reviews, plans: every job whose first `Ticket:` path lies in `spec/features/<id>-<slug>/`) spent against the ticket's caps per feature (roadmap entry 33), answered without the model:

```
AC0001: 3 jobs, 1 in a run
budgetUsd: $1.2345 of $15 (perFeature)
hours: 0.52 h of 8 h (ticket AC0001)
cpu: 4 cores for all its jobs (perFeature)
memory: no cap
```

- `budgetUsd`: the sum of the jobs' `cost`; a job whose `cost` is missing or broken counts as its whole `budget`, and with no budget the spend is `unknown (a job with neither its cost nor a budget)`, which reaches every money cap.
- `hours`: the sum of the time each job spent in a run (`working`, `idle`, or held by a plugin), a job in a run counted up to now.
- `cpu`, `memory`: what the ticket's slice gives all its jobs together; the spend is not measured.
- After each cap, where it comes from: `ticket <id>` (the `caps` of the ticket's JSON block) or `perFeature`; `no cap` when neither sets it or it is `0`.

Refused (exit code 1, after `arthur resources: `): a ticket on no board that has no jobs, `<id>: no such ticket on the board, and no jobs`; a ticket whose JSON block is not JSON or whose `caps` have the wrong shape, naming the file. Wrong usage (more than one argument, or one that is not an id such as `AC0001`) prints `usage: arthur resources [<ticket id>]` and exits 2; on a channel, `/resources` with any text answers `usage: /resources`.

What the caps do, the `cap-reached` event, and how each machine is checked: `docs/resources.md` of the `resources` plugin.
