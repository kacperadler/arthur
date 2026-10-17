# AR0103 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. Arthur's home folder `.arthur/` in its own clone is not ignored by Git

- Kind: bug
- Found by: 2026-10-17-ar0103-readme-9e58b7a9 (worker), 2026-10-17
- Where: `.gitignore`
- What: `docs/deploy.md` step 2 puts `arthur.config.ts` in the clone, so `core.home` defaults to `.arthur/` inside it. `.gitignore` holds `.h/`, `.env`, `node_modules/` and `arthur.config.ts`, not `.arthur/`. With the README's try config, `arthur projects` alone created `.arthur/projects/checkouts` and `.arthur/orchestration`, and `git status --short` then showed `?? .arthur/`: a `git add --all` in the clone would commit the event log and the job records.
- Suggestion: add `.arthur/` to `.gitignore`; nothing else changes.
- Status: fixed in c7c6b7a; ticket AR0104 dropped
