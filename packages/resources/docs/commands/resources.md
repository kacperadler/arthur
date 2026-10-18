# arthur resources

Usage: `arthur resources <ticket id>`

Shows what all jobs of one ticket (worker, reviews, plans: every job whose first `Ticket:` path lies in `spec/features/<id>-<slug>/`) spent against the ticket's caps per feature (roadmap entry 33), answered without the model:

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

Refused (exit code 1, after `arthur resources: `): a ticket on no board that has no jobs, `<id>: no such ticket on the board, and no jobs`; a ticket whose JSON block is not JSON or whose `caps` have the wrong shape, naming the file. Wrong usage (no id, more than one, or not an id such as `AC0001`) prints the usage line and exits 2.

What the caps do, and the `cap-reached` event: `docs/resources.md` of the `resources` plugin, "Caps per feature".
