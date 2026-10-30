# AR0593 - AR0589 T2: a job sees only its own project

```json
{
  "id": "AR0593",
  "title": "AR0589 T2: a job sees only its own project",
  "date": "2026-10-30"
}
```

## Description

Ticket 2 of the approved plan of AR0589 (`spec/features/AR0589-plan-each-project-keeps-all-its-plugin-settings-in-one-place-of-arthur-config-ts/plan.md`, approved in AR-D393, plan.md at 245bd882), section "Ticket 2: a job sees only its project (local machine)". Ticket 1 went in with AR0589 (each project's settings in `projects/<name>/project.config.ts`); today a job of one project still reads every other project's folder, checkout and job worktrees.

## Goal

Inside a job, Arthur loads only that job's project, and the job's sandbox hides every other project's checkout, folder and job worktrees, as the plan's ticket 2 lists.

- Kind: security

## Done means

- The tests the plan names for ticket 2, in `packages/core/test/sandbox.test.ts`, `host.test.ts` and `packages/projects/test/projects.test.ts`, each failing when its guard is removed: a job of one project gets Permission denied on another project's checkout, folder and worktrees, and never loses its own worktree, root, Git folder, record, home, install or config.
- The line budgets the change measures, named.
- `npm run check` and `npm test` pass.

## Scope

In:
- The files the plan's ticket 2 lists: `packages/core/src/plugin.ts`, `plugin-host.ts`, `host.ts`, `cli.ts`, `testing.ts`, `job-sandbox.ts`; `packages/projects/src/projects.ts`; their tests; `packages/core/docs/commands/spawn.md`, `help.md`; `docs/deploy.md`; `docs/plugin-api.md`.

Out:
- The shared home `.arthur/`: AR0590.

## Decisions

- 2026-10-30: Source: the approved plan of AR0589 (AR-D393)
