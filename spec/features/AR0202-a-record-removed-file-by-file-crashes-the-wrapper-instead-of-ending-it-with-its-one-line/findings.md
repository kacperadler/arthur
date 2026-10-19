# AR0202 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The wrapper's append to `log` can still recreate it while `rm -r` empties the record

- Kind: bug
- Found by: 2026-10-19-ar0190-models-jobs-batch-f89d6b5b (worker), 2026-10-19
- Where: `packages/core/src/wrapper.ts` (`save` with `append`, `appendFileSync(join(folder, name), text)`)
- What: AR0202 ends the wrapper at the first failed use once the record's `pid` is gone, but an append to `log` does not fail: it recreates `log` in the folder `rm -r` is emptying, so that `rm -r` can fail with `ENOTEMPTY` before the wrapper's next failing use ends it. [INFERENCE: read from the lines; not reproduced.]
- Suggestion: before appending, end the wrapper when `pid` is gone (`gone()` in `wrapper.ts`), or append with a flag that does not create the file; out: any retry of the use.
- Status: open
