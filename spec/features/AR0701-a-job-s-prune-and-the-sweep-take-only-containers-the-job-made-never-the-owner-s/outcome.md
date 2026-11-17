# AR0701 - Outcome

- Merged: 2026-11-17, `9723a365`
- Branch: arthur/2026-11-17-worker-e60ea741
- Reviews: review-1.md PASS
- Cost: worker $5.08, reviews $1.01; review rounds 1

## What went in

- `packages/docker/src/docker-label.ts`: adds `--label arthur.container=<id>` to `run`, `create`, `container run` and `container create`, and drops every word that sets `arthur.container` as it does for `arthur.job`.
- `packages/docker/src/docker-cleanup.ts`: the prune lists containers by `arthur.container=<id>`, or by the compose project together with `com.docker.compose.config-hash`; other kinds as before.
- `packages/docker/src/docker-look.ts`: a container names a job only by `arthur.container`, or by its compose project when it carries compose's config hash; this feeds the sweep and `arthur docker`.
- `packages/docker/test/fake-docker.ts`: `run` and `create` add a container in `ps`'s shape that takes its image's labels under its own, with `--name` and `-v` volumes (anonymous or named).
- `packages/docker/test/docker-shapes.json`: records the sources for compose's container-only config hash and moby's label merge.
- `packages/docker/test/fake-shapes.test.ts`: checks that a container made by the fake's `run` or `create` has `ps`'s keys and inherits its image's labels.
- `packages/docker/test/labels.test.ts`: container commands get both labels; every spelling of `arthur.container` is dropped.
- `packages/docker/test/cleanup.test.ts`: test fixtures carry the labels their maker gives; new tests for the owner's containers surviving the prune (with their volumes) and for one refused listing stopping the cleanup.
- `packages/docker/test/sweep.test.ts`: test fixtures carry the labels their maker gives; new test for the owner's containers from a gone job's images surviving the sweep, while the job's own container goes.
- `packages/docker/docs/docker.md`: documents the container label, why it exists, and how the prune and sweep find a job's containers.
- `packages/docker/docs/commands/docker.md`: `arthur docker` counts a container for a job by `arthur.container` or by compose project plus config hash.
- `spec/roadmap.md`: entries 70 and 71 name `arthur.container` and the config-hash rule.
- `test/structure.test.ts`: docker line budget raised from 697 to 705.
- `spec/features/AR0701-a-job-s-prune-and-the-sweep-take-only-containers-the-job-made-never-the-owner-s/findings.md`: new file with F1, the ways an image can still carry `arthur.container`.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1817/1888 passed.

## Left open

- Deferred (client summary): F1. An image can still carry `arthur.container`, and then the owner's container from it counts as a job's
- Deferred (client summary): F2. compose's config hash can also reach an image, which adds to F1
