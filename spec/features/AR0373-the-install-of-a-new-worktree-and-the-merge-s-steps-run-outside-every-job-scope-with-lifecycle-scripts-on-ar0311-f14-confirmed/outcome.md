# AR0373 - Outcome

- Merged: 2026-10-26, `6e75ab11`
- Branch: arthur/2026-10-26-worker-9f5b347e
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $6.65, reviews n/a; review rounds 2

## What went in

- `packages/projects/src/install.ts`: the projects plugin no longer runs the install itself; its prepare hands the command to the job as `ARTHUR_INSTALL`.
- `packages/core/src/job-install.ts`, `wrapper.ts`, `jobs.ts`: the wrapper runs that install first, in the worktree and the job's scope, its output in the job's log after an `install:` line; `arthur stop`, the time and memory limits stop it as they stop the agent, and a stop before the agent starts (also after the install exited while a forked child holds its output) starts no agent. A failed install ends the job `failed`, worktree and branch kept. Works on another machine too.
- `packages/delivery/src/merge-checks.ts`, `merge-command.ts`: each merge step runs in a transient scope under the jobs' slice, stopped after it; without systemd the steps run bare with one `uncapped:` line.
- `packages/core/src/host.ts`, `docs/plugin-api.md`: `jobs.slice` for plugins.
- Docs: `projects.md` (Install), `spawn.md`, `merge.md`. Line budgets core 6228, delivery 1361, projects 482 (AR-D57).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1149/1155 passed.

## Left open

- F1 to F5: dropped under AR-D53 (see findings.md); AR0447 dropped.
