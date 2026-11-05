# AR0629 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A merge run whose pid another process took after a reboot is never told

- Kind: fix
- Found by: 2026-11-05-worker-be6656d0 (worker), 2026-11-05
- Where: `packages/delivery/src/pass-forward.ts:65`
- What: `arthur run` tells the coordinator of a merge it started once `<delivery folder>/merge-runs/<job>-<x>/exit` exists or the pid in `run.json` is gone. A merge killed by a reboot leaves neither, and when a new process got that pid after the reboot, `alive(pid)` stays true, so the folder is polled every 5 seconds and the coordinator is never woken; the dead merge's lock is still rolled back at start (the core's lock knows the boot id). [INFERENCE] from the lines, not reproduced.
- Suggestion: write the boot id (`/proc/sys/kernel/random/boot_id`) beside the pid in `run.json`, as the core's lock does, and count a run of another boot as ended; or ask `@arthur/core/lock` to publish its liveness check.
- Status: deferred (client summary)

## F2. no test covers the probe and scope unit names, because this host has no user bus

- Kind: fix
- Found by: 2026-11-05-review-4f5c4b06 (review), 2026-11-05
- Where: `packages/delivery/src/pass-forward.ts:45`
- What: The owner accepted this.
- Status: deferred (client summary)
