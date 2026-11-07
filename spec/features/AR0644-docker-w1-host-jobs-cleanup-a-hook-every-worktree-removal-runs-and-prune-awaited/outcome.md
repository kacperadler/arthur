# AR0644 - Outcome

- Merged: 2026-11-07, `bd1a5bac`
- Branch: arthur/2026-11-06-worker-926f0a0f
- Reviews: review-1.md PASS, review-2.md PASS, review-3.md PASS
- Cost: worker $12.35, reviews $1.42; review rounds 3

## What went in

- README.md: no longer lists the core's cleanup hooks as planned; the core box names them; main's activity line kept.
- arthur.mmd: the job runner node lists cleanup hooks; the "later in the core" node is gone; main's stats node and status line kept.
- docs/plugin-api.md: `jobs.cleanup(fn)` row; `jobs.prune(ids)` is a promise, run one job after another; AR0644 entry under "Changes since entry 51", after main's entries.
- packages/core/docs/commands/prune.md: describes the cleanup hooks: when they run, order, limit, notice, line text, repeats.
- packages/core/src/job-cleanup.ts: new; each plugin's cleanup hooks, run in order with a per-hook limit (120 s by default), a notice on failure, and the returned texts.
- packages/core/src/job-records.ts: `prune` is async and runs the hooks right before the worktree removal, here or there; `jobUpkeep.prune` awaits jobs one by one.
- packages/core/src/jobs.ts: the runner's `cleanup(owner, fn, limitMs?)`, passed to `jobUpkeep`.
- packages/core/src/host-jobs.ts: `cleanup(fn)` member; `prune` returns `Promise<string[]>`.
- packages/core/src/plugin-host.ts: `jobs.cleanup` registers as the calling plugin.
- packages/core/src/job-commands.ts: `arthur prune` awaits the prune.
- packages/core/test/job-records.test.ts: awaits prunes; a new test of the hook contract.
- packages/core/test/job-control.test.ts: awaits prunes.
- packages/core/test/machine.test.ts: awaits prunes; hooks on a job there, and before an SSH that does not answer.
- packages/core/test/testing.test.ts: a hook through the fake host is named by its plugin.
- packages/delivery/src/ticket-prune.ts: `pruneTicket` is async and awaits both prunes.
- packages/delivery/src/delivery.ts: the drop returns its promise to the event bus; the drop at a job's end catches and logs a rejection.
- packages/delivery/src/merge-command.ts: awaits `pruneTicket`.
- packages/delivery/test/merge.test.ts: waits for the drop's lines; a new test that a rejected drop prune is logged on both paths.
- packages/delivery/test/review.test.ts: waits for the drop's lines.
- packages/github/test/github-branch.test.ts: awaits `host.jobs.prune`.
- packages/manage/src/cleanup.ts: each part is awaited, and the prune part awaits `host.jobs.prune`.
- test/structure.test.ts: core budget 7438 and delivery budget 2220 (main's numbers plus this branch's 51 and 1, AR-D550).
- spec/features/AR0644-docker-w1-host-jobs-cleanup-a-hook-every-worktree-removal-runs-and-prune-awaited/findings.md: new; F1 (Decisions to record) and F2 (a hook past its limit is not stopped).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1576/1647 passed.

## Left open

- Deferred (client summary): F1. The ticket's Decisions do not yet record the two API changes
- Deferred (client summary): F2. A hook past its time limit is given up, not stopped
