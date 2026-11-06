# AR0645 - Docker W2: the docker plugin labels what a job creates, and machines gives its labels (roadmap 70)

```json
{
  "id": "AR0645",
  "title": "Docker W2: the docker plugin labels what a job creates, and machines gives its labels (roadmap 70)",
  "date": "2026-11-06"
}
```

## Description

Ticket W2 of the AR0604 plan, which the owner approved with every recommendation on 2026-11-06 (AR-D520): the docker plugin and the core's cleanup hook, so the Docker resources jobs create go with their worktree and leftovers are swept. The owner reads this branch as a GitHub pull request before it is merged (AR-D518, AR-D519).

## Goal

Approach item 2 (W2) and Files, W2: the new `packages/docker` plugin (options, `docker.project(false)`, the per-job `docker` script that adds `--label arthur.job=<id>`, `COMPOSE_PROJECT_NAME`, `resources.disk`, doctor), and `machines.labels` provided by machines (Not available directly 2, Option 1); first docker budget about 340, as `spec/features/AR0604-plan-the-docker-plugin-and-the-core-cleanup-hook-roadmap-70-to-72/plan.md` lays it out. Approved with it: the sandbox unchanged (Not available directly 1, Option 1), `docker.project({ service })` held out (item 3, Option 1), the plan's three API changes (`host.jobs.cleanup`, `host.jobs.prune` a promise, `machines.labels`), and its line budgets.

- Kind: feat

## Done means

- Every point of W2 in the plan's Approach and Files works, each shown by a test that fails when it is removed; the plan's "How to test" lines for W2 hold.
- Docker and SSH are faked in tests in the shape Docker's CLI prints, as the plan's Files describe; no test touches the real Docker of this machine.
- The docs of every command and host member it adds or changes say what it does; an API change is recorded in `docs/plugin-api.md`.
- `npm run check` and `npm test` pass; each line budget raised names its new number in the final message.

## Scope

In:
- `packages/docker/` and the root and machines files Files W2 names.

Out:
- The other tickets of the AR0604 plan: their own tickets.
- A change to the job sandbox; `docker.project({ service })`.

## Decisions

