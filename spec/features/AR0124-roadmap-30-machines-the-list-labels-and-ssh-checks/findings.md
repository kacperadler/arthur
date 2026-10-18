# AR0124 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. Roadmap 30 names `npm i -g arthur` as the fix for a machine without Arthur, which does not install it

- Kind: cleanup
- Found by: 2026-10-18-ar0124-machines-list-56a82238 (worker), 2026-10-18
- Where: `spec/roadmap.md:292` (entry 30, Also delivers); `docs/deploy.md:12`
- What: entry 30 lists `npm i -g arthur` among the doctor fixes. Every `package.json` here is `"private": true` and nothing is published to npm; `docs/deploy.md` step 2 installs the core on another machine by cloning and `npm ci` at the same commit. The machines plugin's fix follows deploy.md (`install Arthur's core there at this commit, arthur on the PATH of a command over ssh (docs/deploy.md)`), so the roadmap and the code now say different things.
- Suggestion: change the roadmap's fix to deploy.md's install; nothing in the code changes.
- Status: open
