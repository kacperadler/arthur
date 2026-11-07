# AR0644 - Docker W1: host.jobs.cleanup, a hook every worktree removal runs, and prune awaited (roadmap 71, core half)

```json
{
  "id": "AR0644",
  "title": "Docker W1: host.jobs.cleanup, a hook every worktree removal runs, and prune awaited (roadmap 71, core half)",
  "date": "2026-11-06"
}
```

## Description

Ticket W1 of the AR0604 plan, which the owner approved with every recommendation on 2026-11-06 (AR-D520): the docker plugin and the core's cleanup hook, so the Docker resources jobs create go with their worktree and leftovers are swept. The owner reads this branch as a GitHub pull request before it is merged (AR-D518, AR-D519).

## Goal

Approach item 1 (W1) and Files, W1: `host.jobs.cleanup(fn)` run inside `prune` right before the worktree goes, one hook at a time, 2 minutes each, a failure a `notice` that never keeps the worktree; `host.jobs.prune` returns a promise and every caller awaits it, as `spec/features/AR0604-plan-the-docker-plugin-and-the-core-cleanup-hook-roadmap-70-to-72/plan.md` lays it out. Approved with it: the sandbox unchanged (Not available directly 1, Option 1), `docker.project({ service })` held out (item 3, Option 1), the plan's three API changes (`host.jobs.cleanup`, `host.jobs.prune` a promise, `machines.labels`), and its line budgets.

- Kind: feat

## Done means

- Every point of W1 in the plan's Approach and Files works, each shown by a test that fails when it is removed; the plan's "How to test" lines for W1 hold.
- Docker and SSH are faked in tests in the shape Docker's CLI prints, as the plan's Files describe; no test touches the real Docker of this machine.
- The docs of every command and host member it adds or changes say what it does; an API change is recorded in `docs/plugin-api.md`.
- `npm run check` and `npm test` pass; each line budget raised names its new number in the final message.

## Scope

In:
- the core, delivery and manage files Files W1 names, their docs (`packages/core/docs/commands/prune.md`, `docs/plugin-api.md`) and tests.

Out:
- The other tickets of the AR0604 plan: their own tickets.
- A change to the job sandbox; `docker.project({ service })`.

## Decisions
- 2026-11-07: AR0644 worker budget $8 -> $12 to resolve its merge conflicts, under the owner order to fix what cannot merge; the owner: "if you cant merge something check why and fix that on github" (AR-D543)
- 2026-11-07: AR0644 worker budget $12 -> $15 to merge main again (arthur.mmd conflict) and rerun its checks, under the owner order to fix what cannot merge; the owner: "if you cant merge something check why and fix that on github" (AR-D547)
- 2026-11-07: AR0644: core line budget 7387 -> 7438 and delivery main + 1 (2220), under the owner approval of PR #10 and the order to fix what cannot merge; the owner: "Approve (PR #10); if you cant merge something check why and fix that on github" (AR-D550)

