# AR0593 - Outcome

- Merged: 2026-10-31, `d8013c2d`
- Branch: arthur/2026-10-31-worker-e0b23183
- Reviews: review-1.md PASS
- Cost: worker $7.22, reviews $0.47; review rounds 1

## What went in

- docs/deploy.md: the threat model lists what a job of one project cannot read, and what stays readable (the shared home, project names and paths, `arthur.config.ts`, the install).
- docs/plugin-api.md: documents `host.job`, the AR0593 change entry, and that `projects` serves only the job's own project inside a job.
- packages/core/docs/commands/help.md: inside a job each plugin gets `host.job`, and the projects plugin loads only the job's project or refuses.
- packages/core/docs/commands/spawn.md: "The sandbox" explains how other projects' checkouts, folders and worktrees are hidden, what is never hidden, and the new log line.
- packages/core/src/cli.ts: passes `insideJob`'s id to `loadPlugins`.
- packages/core/src/host.ts: `loadPlugins` takes the job id, reads the record's `project`, and gives every plugin `host.job`.
- packages/core/src/job-sandbox.ts: `hidden()` adds other projects' checkouts and folders and other job worktrees, never one that holds the job's own places; the Git folder lookup is shared with `writable`.
- packages/core/src/plugin-host.ts: passes `job` through to the host.
- packages/core/src/plugin.ts: `Host.job?: { id, project }`.
- packages/core/src/testing.ts: the fake host takes a `job` option.
- packages/core/test/host.test.ts: callers pass a job id; a new test covers `Host.job` from the record, `""` without one, and undefined outside a job.
- packages/core/test/sandbox.test.ts: a real job of shop1 gets Permission denied on shop2's checkout, its folder, other worktrees and the env file, and keeps its worktree, root, Git folder, record, home, install, config and own folder; its commit still works.
- packages/projects/docs/commands/projects.md: documents the `folders` list and the in-job load and its refusal.
- packages/projects/src/projects.ts: inside a job imports only the job's project folder or refuses, and leaves the lists alone; outside a job writes `checkouts` and `folders`.
- packages/projects/test/projects.test.ts: `folders` is written and kept; inside a job only shop1 is served, shop2's file is never imported (checked with a marker file), the lists are untouched, and an unknown or empty project is refused.
- spec/features/AR0593-ar0589-t2-a-job-sees-only-its-own-project/findings.md: F1, the next run trusts record fields the agent can rewrite.
- test/job-gate.test.ts: the in-job CLI tests put the job's record, naming its project, in the home.
- test/structure.test.ts: line budgets core 6600, projects 564.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1335/1404 passed.

## Left open

- Deferred (client summary): F1. A job's next run trusts the record fields its agent can rewrite
- Deferred (client summary): F2. `otherProjects` reads `project`, `worktree` and `root` from the job's record folder, which the agent can write
- Deferred (client summary): F3. the core reads `<home>/projects/checkouts` and `folders`, which are the projects plugin's files
