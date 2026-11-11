# AR0690 - docker buildx with its own options before build (docker buildx --builder x build) gets no job label, and a foreign arthur.job label stays

```json
{
  "id": "AR0690",
  "title": "docker buildx with its own options before build (docker buildx --builder x build) gets no job label, and a foreign arthur.job label stays",
  "date": "2026-11-11"
}
```

## Description

A job's `docker` script labels each image it builds with the job's id, so the image goes with the job's worktree. When the job puts buildx's own options between `buildx` and `build`, the build is not recognised, so the image gets no label and a label the job wrote for another job stays.

## Goal

From the AR0645 review (2026-11-11-review-b040a112, Notes, bug): `packages/docker/src/docker-label.ts:49` matches `CREATES` only on adjacent words, so `labelled(["buildx","--builder","x","build","--label","arthur.job=other","."], "mine")` returns the arguments unchanged. Docker 29.9.2 on this server runs that spelling as `buildx build`: `docker buildx --builder default build --help` and `docker buildx --debug build --help` both print `Usage:  docker buildx build`. Roadmap 70 lists `buildx build` among the commands labelled. Calling `docker` by its absolute path already skips the labels (documented), so this is a gap in what gets labelled, not a new way around a security boundary.

- Kind: fix

## Done means

- `docker buildx --builder x build ...` and `docker buildx --debug build ...` (buildx's own options before `build`, a valued one and a flag) get `--label arthur.job=<id>` after `build`, and every `arthur.job` word after it is dropped, as for `buildx build`.
- A test in `packages/docker/test/labels.test.ts` with those two rows fails before the change and passes after it.
- The project's checks pass.

## Scope

In:
- `packages/docker/src/docker-label.ts`: skip buildx's own options between `buildx` and `build` (`--builder <name>`, `--debug`/`-D`), as docker's own options are skipped before the command.
- `packages/docker/test/labels.test.ts`: the rows above.

Out:
- Other commands that build without being on the list (`builder build`, `buildx b`, `commit`, `image import`): the existing F2 of AR0645.

## Decisions
- 2026-11-11: AR0690 approved; the owner: "AR-D638 - approve" (AR-D638)
