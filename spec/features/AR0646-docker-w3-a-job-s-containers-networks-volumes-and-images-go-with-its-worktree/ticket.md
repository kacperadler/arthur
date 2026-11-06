# AR0646 - Docker W3: a job's containers, networks, volumes and images go with its worktree (roadmap 71, docker half)

```json
{
  "id": "AR0646",
  "title": "Docker W3: a job's containers, networks, volumes and images go with its worktree (roadmap 71, docker half)",
  "date": "2026-11-06"
}
```

## Description

Ticket W3 of the AR0604 plan, which the owner approved with every recommendation on 2026-11-06 (AR-D520): the docker plugin and the core's cleanup hook, so the Docker resources jobs create go with their worktree and leftovers are swept. The owner reads this branch as a GitHub pull request before it is merged (AR-D518, AR-D519).

## Goal

Approach item 3 (W3) and Files, W3: the cleanup hook, its refusals kept and named, `docker builder prune --max-used-space`, one line per job, as `spec/features/AR0604-plan-the-docker-plugin-and-the-core-cleanup-hook-roadmap-70-to-72/plan.md` lays it out. Approved with it: the sandbox unchanged (Not available directly 1, Option 1), `docker.project({ service })` held out (item 3, Option 1), the plan's three API changes (`host.jobs.cleanup`, `host.jobs.prune` a promise, `machines.labels`), and its line budgets.

- Kind: feat

## Done means

- Every point of W3 in the plan's Approach and Files works, each shown by a test that fails when it is removed; the plan's "How to test" lines for W3 hold.
- Docker and SSH are faked in tests in the shape Docker's CLI prints, as the plan's Files describe; no test touches the real Docker of this machine.
- The docs of every command and host member it adds or changes say what it does; an API change is recorded in `docs/plugin-api.md`.
- `npm run check` and `npm test` pass; each line budget raised names its new number in the final message.

## Scope

In:
- `packages/docker/src/docker-cleanup.ts`, `src/docker.ts`, its fake, tests and docs.

Out:
- The other tickets of the AR0604 plan: their own tickets.
- A change to the job sandbox; `docker.project({ service })`.

## Decisions

