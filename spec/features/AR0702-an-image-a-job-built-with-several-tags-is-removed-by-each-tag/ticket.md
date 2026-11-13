# AR0702 - An image a job built with several tags is removed by each tag

```json
{
  "id": "AR0702",
  "title": "An image a job built with several tags is removed by each tag",
  "date": "2026-11-13"
}
```

## Description

`docker image ls` prints one row per tag, and the docker plugin removes a job's images by ID. Docker refuses `docker image rm <ID>` for an image with several tags, so an image built with `-t app:latest -t app:<sha>` is kept at every prune and every daily sweep, forever. After this fix a tagged image is removed by each of its tags, and it is counted once.

## Goal

`docker build -t app:latest -t app:<sha>` is a common pattern. Each such image is "kept" at every prune and every daily sweep, forever. That is the disk-filling leftover decision 19 exists to stop.

Evidence:
- `packages/docker/src/docker-look.ts:71-73`: each `image ls` row becomes the word `image:<ID>`. Docker prints one row per tag, so an image with two tags gives the same word twice.
- `packages/docker/src/docker-cleanup.ts:64-69`: the prune keys images by `image:<ID>`. `:34` runs `docker image rm <ID>`, and the sweep does the same at `docker-sweep.ts:35`.
- `docker image rm <ID>` on an image referenced by several repositories is refused unless forced ("image is referenced in multiple repositories") ([INFERENCE] from Docker's documented behaviour). `packages/docker/test/fake-docker.ts:146-148` removes the first row with that ID and never refuses, so no test can catch this.

- Kind: fix

## Done means

- The prune and the sweep remove a tagged image by each `<repository>:<tag>` (the last untag deletes it) and a dangling one by its ID.
- `arthur docker` and the prune's and the sweep's lines count such an image once.
- The fake Docker refuses `image rm <ID>` for an image with several tags, as Docker does; a test of a two-tag image in the prune and in the sweep fails on today's code and passes after.

## Scope

In:
- `packages/docker/src/docker-look.ts`, `packages/docker/src/docker-cleanup.ts`, `packages/docker/src/docker-sweep.ts`: remove by tag, count once.
- `packages/docker/test/fake-docker.ts` and its tests.

Out:
- Container handling: AR0701.

## Decisions

- 2026-11-13: Source: audit spec/quality/2026-11-13.md
- 2026-11-13: Source: F4 of AR0647
- 2026-11-13: Source: F3 of AR0646
