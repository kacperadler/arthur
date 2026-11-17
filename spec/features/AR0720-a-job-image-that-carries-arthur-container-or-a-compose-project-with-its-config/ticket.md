# AR0720 - A job image that carries arthur.container or a compose project with its config hash makes the owner container from it count as the job, so the prune and the sweep take it

```json
{
  "id": "AR0720",
  "title": "A job image that carries arthur.container or a compose project with its config hash makes the owner container from it count as the job, so the prune and the sweep take it",
  "date": "2026-11-17"
}
```

## Description

AR0701 made the prune and the sweep take only the containers a job made. An image a job built can still carry the labels that mark a job's container, and a container takes its image's labels, so a container the owner starts from such an image is still taken. This ticket keeps those labels off every image a job makes.

## Goal

From F1 and F2 of AR0701 (`spec/features/AR0701-a-job-s-prune-and-the-sweep-take-only-containers-the-job-made-never-the-owner-s/findings.md`). The job's `docker` script (`packages/docker/src/docker-label.ts:55-59`) drops `--label` words that set `arthur.container` on a build, but three ways still put a container's marks on an image: a Dockerfile `LABEL` line, a `--label-file` (left alone by the script), and `docker commit` of a job's container (a command the script does not label), whose image keeps the container's labels. A container takes every label of its image it was not given itself (moby `daemon/commit.go`, `merge`). The prune (`packages/docker/src/docker-cleanup.ts`) and the sweep (`packages/docker/src/docker-look.ts:46-48`) count a container as the job's by `arthur.container=<id>`, or by the compose project together with `com.docker.compose.config-hash`, so a container the owner starts from such an image is stopped and removed with its anonymous volumes. The owner asked for this fix (2026-11-17, "ticket it").

- Kind: fix

## Done means

- An image a job builds (`build`, `buildx build`, `image build`) or commits (`commit`, `container commit`) never makes a container from it count as that job's: whatever its Dockerfile `LABEL`, a `--label-file` or the committed container held, both `arthur.container` and the compose config hash it would pass on read as none. The worker picks the means (an empty label that wins, `--change 'LABEL ...='` on commit, or the reading side) and says why.
- Tests in `packages/docker/test/` that fail before the change and pass after it: an owner's container from an image with a Dockerfile `LABEL arthur.container=<id>`, from one built with a `--label-file` that holds it, from a committed job container, and from a committed compose container of the job; the prune and the sweep leave each, and still remove the containers the job made.
- The fake Docker learns `commit` in the shape Docker's documentation shows, if the tests need it.
- The project's checks pass.

## Scope

In:
- `packages/docker/src/docker-label.ts`: what the script adds on a build and a commit.
- `packages/docker/src/docker-cleanup.ts`, `packages/docker/src/docker-look.ts`: how an empty mark is read, if the means needs it.
- `packages/docker/test/`: the tests above and the fake Docker.
- `packages/docker/docs/docker.md`: one line on what an image a job makes never carries.

Out:
- Images the owner builds himself, outside a job.
- A command that calls Docker's API directly or `docker` by its absolute path: the sweep's leftovers, as documented.

## Decisions
- 2026-11-17: AR0720 approved, budget 10, after AR0702; the owner: "AR-D690 approve" (AR-D690)
