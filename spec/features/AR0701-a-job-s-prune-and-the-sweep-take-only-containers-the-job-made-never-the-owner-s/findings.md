# AR0701 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. An image can still carry `arthur.container`, and then the owner's container from it counts as a job's

- Kind: fix
- Found by: 2026-11-17-worker-e60ea741 (worker), 2026-11-17
- Where: `packages/docker/src/docker-label.ts:55-59`
- What: the script drops every `--label` word that sets `arthur.container` on `build`, but three ways still put the key on an image, and a container takes every label of its image it was not given itself (moby `daemon/commit.go`, `merge`): a `LABEL arthur.container=<id>` line in a Dockerfile a job builds, a `--label-file` holding it (the script leaves `--label-file` alone), and `docker commit` of a job's container, whose image keeps the container's labels (`commit` is not a command the script labels). A container the owner then starts from that image carries `arthur.container=<id>`, and the job's prune stops and removes it with its anonymous volumes, as before AR0701. [INFERENCE] from Docker's documented behaviour; no test covers it, as the fake docker does not build images.
- Suggestion: on `build`, `buildx build` and `image build`, add `--label arthur.container=` (empty) after the job's label, which wins over a Dockerfile `LABEL` and a `--label-file`, and read an empty `arthur.container` as none in the prune's listing and in `docker-look.ts`'s `jobOf`; for `docker commit`, add `--change 'LABEL arthur.container='` in the script. Out: images the owner builds himself.
- Status: deferred (client summary)

## F2. compose's config hash can also reach an image, which adds to F1

- Kind: fix
- Found by: 2026-11-17-review-de1b984c (review), 2026-11-17
- Where: `packages/docker/src/docker-look.ts:48`
- What: F1 covers only `arthur.container`. If a job runs `docker commit` on one of its compose containers, or a Dockerfile has `LABEL com.docker.compose.config-hash=…`, the image carries the project label and the config hash. An owner's container from that image then passes the project-plus-hash test, so the prune and the sweep take it again.
- Status: deferred (client summary)
