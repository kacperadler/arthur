# AR0701 - A job's prune and the sweep take only containers the job made, never the owner's container from a job's image

```json
{
  "id": "AR0701",
  "title": "A job's prune and the sweep take only containers the job made, never the owner's container from a job's image",
  "date": "2026-11-13",
  "budget": 2
}
```

## Description

The docker plugin labels the images a job builds with `arthur.job=<id>`, and Docker copies an image's labels onto every container made from it. So a container the owner starts himself from a job-built image carries the job's label: the job's prune stops it, even while it runs, and removes it with its anonymous volumes, and the sweep takes it once stopped. After this fix a container counts as a job's only when the docker script made it.

## Goal

An owner container started from a job-built tag (`docker run shop:latest`) carries `arthur.job=<id>`. The job's prune stops it, even while running, and deletes its anonymous volumes. That loses the owner's work, with no prompt. The docker plugin is off in the owner's config today, so this hits as soon as decision 19 turns it on.

Evidence:
- `packages/docker/src/docker-label.ts:40-52`: `labelled` adds `--label arthur.job=<id>` to `build`, so the label goes on the image itself.
- `packages/docker/src/docker-cleanup.ts:22`: the prune's listing finds containers with `--filter "label=arthur.job=$1"`.
- `packages/docker/src/docker-cleanup.ts:31`: every container listed is stopped, running ones included (`docker container stop --timeout 10 $containers`). `:34` then removes each one with `--volumes`.
- `packages/docker/src/docker-sweep.ts:55`: once the job's record is gone, the sweep removes stopped containers carrying its label.
- Docker copies an image's labels onto each container made from it ([INFERENCE] from Docker's documented behaviour; `packages/docker/test/fake-docker.ts` does not model it).
- Vision, "Disk space and Docker": a job's cleanup takes "the job's containers"; the sweep "never touches a running container".

- Kind: fix

## Done means

- A container counts as a job's only when the docker script labelled it as a container (for example a second label only `run` and `create` add, `arthur.container=<id>`), in both the prune and the sweep.
- The fake Docker copies an image's labels onto containers made from it, as Docker does.
- A test runs an owner's container (no `arthur.container` label) from a job-built image: the job's prune and the sweep leave it, running or stopped, with its volumes; it fails on today's code and passes after. A container the job made is still removed.

## Scope

In:
- `packages/docker/src/docker-label.ts`: the container label on `run` and `create`.
- `packages/docker/src/docker-cleanup.ts`, `packages/docker/src/docker-sweep.ts`: list containers by that label.
- `packages/docker/test/fake-docker.ts` and its tests: label inheritance and the owner's-container test.

Out:
- Image handling: AR0702.

## Decisions

- 2026-11-13: Source: audit spec/quality/2026-11-13.md
- 2026-11-13: Source: F6 of AR0647
