# AR0269 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A check of its own still makes two ssh calls to a machine with a disk floor

- Kind: improvement
- Found by: 2026-10-22-ar0269-one-ssh-call-per-c337cff3 (worker), 2026-10-22
- Where: `packages/resources/src/machine-free.ts` (`checkSample`, `measure`), `packages/resources/src/machine-disk.ts` (`measureDisk`)
- What: outside a round of the `machines` plugin (a sample missing or older than twice its round's `everySeconds`, `arthur spawn` or `arthur resources` from a shell), the resources plugin's own check of a listed machine runs `node -e` over ssh (`measure`, its `host.jobs.run(name, ["node", "-e", SCRIPT])`), then, with `keepFree.disk` above 0 and no round's df, `df -Pk` in a second ssh call (`measureDisk`, from `checkSample`). Read from the lines, not counted by a run.
- Suggestion: run the `node -e` script and the df loop in one `sh -c` there, the free line first, and read both with the parsers there are (`measure`'s JSON, `readDisk`). Out: the round, which AR0269 already serves with one call.
- Status: open
