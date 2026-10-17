# AR0092 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A project added to the config is unguarded until some `arthur` command loads it

- Kind: risk
- Found by: 2026-10-17-ar0092-c3f72abb (worker), 2026-10-17
- Where: `packages/projects/src/projects.ts` (`keepCheckouts`, run in `setup`), `packages/core/src/cli.ts` (`loadConfig` once per command)
- What: `<home>/projects/checkouts` is rewritten when the config loads, which each `arthur` command does once at its start; the daemon `arthur run` loads it once and does not reload. Between a human saving `arthur.config.ts` with a new project and the next `arthur` command (`arthur projects`, a spawn, `arthur jobs`), a running job of another project may still write into the new project's checkout.
- Suggestion: have `arthur run` reload the project list on each sweep (or when `arthur.config.ts` changes), or tell the human in `docs/commands/projects.md` to run `arthur projects` after adding one; the guard itself stays as it is.
- Status: ticket AR0095 (dropped 2026-10-17 by the coordinator: any arthur command, a spawn included, reloads the list; the residual window is small)

## F2. `job-place.ts` matches no always-review keyword

- Kind: risk
- Found by: 2026-10-17-review-ar0092-5fca353c (review), 2026-10-17
- Where: `packages/core/src/job-place.ts`, `arthur.config.example.ts` (`review.alwaysReview`)
- What: the guard's code moved partly into `job-place.ts`; neither it nor `worktree-guard.ts` matches a keyword of the example list. No plugin enforces the list yet.
- Suggestion: name the guard files when the delivery plugin builds the always-review list.
- Status: dropped (nothing enforces the list yet; the delivery plugin's entry sets it)
