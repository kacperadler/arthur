# AR0274 - A worker learns of `arthur plugin new --root` only if its ticket or plan names it

```json
{
  "id": "AR0274",
  "title": "A worker learns of `arthur plugin new --root` only if its ticket or plan names it",
  "date": "2026-10-21"
}
```

## Description

in its worktree a job's `arthur plugin --help` cannot answer, since the CLI loads `arthur.config.ts` from the folder it runs in and a worktree lacks it; the way in, `cd <checkout> && arthur plugin new <name> --budget <lines> --root <worktree>`, is written only in `plugin.md`. No role names it (`grep -n "arthur " packages/core/roles/worker.md` finds nothing), so a worker on a new plugin's ticket may hand-write the package instead.

## Goal

A worker on a new plugin's ticket learns from its role how to run `arthur plugin new --root` from the checkout, without the ticket having to say it.

- Kind: improvement

Evidence:
- `packages/core/roles/worker.md`, `packages/orchestration/roles/planner.md`, `packages/develop/docs/commands/plugin.md`
- Found by: 2026-10-21-ar0260-plugin-new-in-a-w-1a01c2ba (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: the planner's role (or the roadmap entry template for a new plugin) puts that line into a new plugin's plan as its first step; where `arthur.config.ts` is read stays as it is.
- `npm test` and `npm run check` pass.

## Scope

In:
- the planner's role (or the roadmap entry template for a new plugin) puts that line into a new plugin's plan as its first step; where `arthur.config.ts` is read stays as it is.

## Decisions

- 2026-10-21: Source: F1 of AR0260
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
