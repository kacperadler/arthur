# AR0260 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. A worker learns of `arthur plugin new --root` only if its ticket or plan names it

- Kind: improvement
- Found by: 2026-10-21-ar0260-plugin-new-in-a-w-1a01c2ba (worker), 2026-10-21
- Where: `packages/core/roles/worker.md`, `packages/orchestration/roles/planner.md`, `packages/develop/docs/commands/plugin.md`
- What: in its worktree a job's `arthur plugin --help` cannot answer, since the CLI loads `arthur.config.ts` from the folder it runs in and a worktree lacks it; the way in, `cd <checkout> && arthur plugin new <name> --budget <lines> --root <worktree>`, is written only in `plugin.md`. No role names it (`grep -n "arthur " packages/core/roles/worker.md` finds nothing), so a worker on a new plugin's ticket may hand-write the package instead.
- Suggestion: the planner's role (or the roadmap entry template for a new plugin) puts that line into a new plugin's plan as its first step; where `arthur.config.ts` is read stays as it is.
- Status: open
