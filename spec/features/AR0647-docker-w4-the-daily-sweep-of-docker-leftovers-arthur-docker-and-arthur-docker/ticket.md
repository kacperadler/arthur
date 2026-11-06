# AR0647 - Docker W4: the daily sweep of Docker leftovers, arthur docker and arthur docker sweep (roadmap 72)

```json
{
  "id": "AR0647",
  "title": "Docker W4: the daily sweep of Docker leftovers, arthur docker and arthur docker sweep (roadmap 72)",
  "date": "2026-11-06"
}
```

## Description

Ticket W4 of the AR0604 plan, which the owner approved with every recommendation on 2026-11-06 (AR-D520): the docker plugin and the core's cleanup hook, so the Docker resources jobs create go with their worktree and leftovers are swept. The owner reads this branch as a GitHub pull request before it is merged (AR-D518, AR-D519).

## Goal

Approach item 4 (W4) and Files, W4: the sweep daily, on `disk-low` and by hand (`--machine`, `--dry-run`), serialised per machine, one notice per sweep; unlabelled leftovers limited to dangling images, unused networks and the build cache, so the owner's own stopped containers and volumes stay, as `spec/features/AR0604-plan-the-docker-plugin-and-the-core-cleanup-hook-roadmap-70-to-72/plan.md` lays it out. Approved with it: the sandbox unchanged (Not available directly 1, Option 1), `docker.project({ service })` held out (item 3, Option 1), the plan's three API changes (`host.jobs.cleanup`, `host.jobs.prune` a promise, `machines.labels`), and its line budgets.

- Kind: feat

## Done means

- Every point of W4 in the plan's Approach and Files works, each shown by a test that fails when it is removed; the plan's "How to test" lines for W4 hold.
- Docker and SSH are faked in tests in the shape Docker's CLI prints, as the plan's Files describe; no test touches the real Docker of this machine.
- The docs of every command and host member it adds or changes say what it does; an API change is recorded in `docs/plugin-api.md`.
- `npm run check` and `npm test` pass; each line budget raised names its new number in the final message.

## Scope

In:
- `packages/docker/src/docker-sweep.ts`, `src/docker-command.ts`, `src/docker.ts`, their docs and tests.

Out:
- The other tickets of the AR0604 plan: their own tickets.
- A change to the job sandbox; `docker.project({ service })`.

## Decisions

