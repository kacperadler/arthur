# AR0299 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A lock left by a crashed process whose pid the taker now has counts as held by a live process

- Kind: risk
- Found by: 2026-10-22-ar0299-69921f31 (worker), 2026-10-22
- Where: `packages/core/src/lock.ts` (`takeLock`, `alive`)
- What: a lock file names its holder's pid and boot; `takeLock` treats a holder whose pid is alive as live, also when that pid is the taker's own, which a new process in the same boot can have when the crashed holder had it (a container restarted with `docker restart` keeps the boot id and starts `arthur run` again as pid 1, [INFERENCE] from Docker's PID namespaces, not run). Then `run.pid` refuses the start (`is already run by pid <its own pid>`), and the `asked/<n>-<time>.lock` a crash left (AR0299) is never taken over. Seen with `node -e` writing `<own pid> <boot id>` into a file and calling `takeLock` on it: it answered `{"heldBy":<own pid>}`.
- Suggestion: tell a lock this process took from one an earlier process of the same pid left, for example a per-process random token written beside the pid and kept in memory, so a file naming this pid without this process's token counts as a dead holder's; this process's own live locks stay held.
- Status: open
