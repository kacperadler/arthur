# AR0262 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The disk check makes a second ssh call per machine and round

- Kind: improvement
- Found by: 2026-10-21-ar0262-roadmap-69-disk-f-82a16dc2 (worker), 2026-10-21
- Where: `packages/resources/src/machine-disk.ts` (`measureDisk`), `packages/machines/src/machine-check.ts` (`SCRIPT`)
- What: with `keepFree.disk` above 0, each round of the `machines` plugin makes its one ssh call for os, arch, version, tools and the free CPU and memory (AR0149), and then the resources plugin's `df -Pk` makes a second ssh call to the same machine. `packages/resources/test/disk.test.ts`, "free space hovering …", counts one ssh call per round, the df alone.
- Suggestion: carry the df in the machines check's one call, as AR0149 did for `node -e`: `machines.round` would need the paths (the home and `collect("resources.disk")`) before the round starts, and its report a `disk` line the resources plugin parses with the same parser. Out: changing what is measured.
- Status: ticket AR0269

## F2. vision.md's disk refusal example differs from the roadmap and the code

- Kind: cleanup
- Found by: 2026-10-21-ar0262-roadmap-69-disk-f-82a16dc2 (worker), 2026-10-21
- Where: `spec/vision.md:160`
- What: the vision gives the refusal as `build: 12.3 GB disk free, floor 20 GB`; roadmap entry 69 gives `build: 12.3 GB free on /var/lib/docker, floor 20 GB`, and the plugin says `build: no room, 12.3 GB free on /var/lib/docker, floor 20 GB` (docs/resources.md in the package, "Free disk").
- Suggestion: align the vision's example with the roadmap's, naming the path. Out: the code.
- Status: ticket AR0270

## F3. Two processes checking one machine at once can both say the same news

- Kind: risk
- Found by: 2026-10-21-ar0262-roadmap-69-disk-f-82a16dc2 (worker), 2026-10-21
- Where: `packages/resources/src/machine-free.ts` (`checkSample`)
- What: whether a failure `notice` or a `disk-low` is new is read from the check kept in `.arthur/resources/machines/<name>.json` before this check writes its own. `arthur run`'s check and an `arthur spawn` in another process that check the same machine at the same moment both read the earlier check, so both can emit `disk-low` and its notice for one fall (and both the failure notice, as since entry 34). [INFERENCE: from the lines; not reproduced.]
- Suggestion: decide and write the transition under a lock per machine file (the core's `withLock`), so only one writer sees the old state. Out: the cadence of the checks.
- Status: ticket AR0271
