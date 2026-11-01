# AR0597 - Outcome

- Merged: 2026-11-01, `b9549ffe`
- Branch: arthur/2026-11-01-worker-ff79fdb2
- Reviews: review-1.md PASS
- Cost: worker $8.73, reviews $1.08; review rounds 1

## What went in

- packages/core/src/job-sandbox.ts: `writable` and `hidden` take the job's place as an argument instead of reading the record; Git folders come from the root's repository; new `misplaced` check.
- packages/core/src/job-control.ts: `continueJob` refuses a record whose place fails `misplaced` against `steps.root(project)`; comment on the wrapper command line updated.
- packages/core/src/job-scope.ts: `launch` passes the job's project, root and worktree on the wrapper's command line.
- packages/core/src/wrapper.ts: takes project, root and worktree from its arguments and never reads them from the record.
- packages/core/src/jobs.ts: a local continue checks the record against the project's checkout from the config (`where(project).root`).
- packages/core/src/remote-job.ts: `launch` passes the record's place from the spawn; `continue` checks it against `<home>/repos/<project>.git`.
- packages/core/test/sandbox.test.ts: `writable` and `hidden` unit tests updated; a `misplaced` unit test; the end-to-end AR0597 test.
- packages/core/docs/commands/continue.md: documents the new refusal and the wrapper getting the checked place.
- packages/core/docs/commands/spawn.md: "The sandbox" says where the place and the Git folders come from.
- docs/deploy.md: new threat-model line for AR0597.
- test/structure.test.ts: core line budget 7039 → 7054.
- spec/features/AR0597-a-job-that-rewrites-its-record-s-project-worktree-or-root-gets-another-project/findings.md: F1 (prune trusts the record) and F2 (forged `extensions`).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1387/1456 passed.

## Left open

- Deferred (client summary): F1. `arthur prune` removes the worktree and branch a job's rewritten record names
- Deferred (client summary): F2. A rewritten `extensions` makes the wrapper grant and create `<home>/<any name>/<id>`
- Deferred (client summary): F3. no test covers the refusal on another machine
- Deferred (client summary): F4. `misplaced` never compares `project` directly
