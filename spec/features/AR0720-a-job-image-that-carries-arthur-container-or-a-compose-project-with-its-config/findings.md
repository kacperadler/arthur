# AR0720 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. An image a job makes past `build` and `commit` still carries a container's marks

- Kind: fix
- Found by: 2026-11-17-worker-f36680a2 (worker), 2026-11-17
- Where: `packages/docker/src/docker-label.ts:11-14`
- What: the script sets both marks empty on `build` (and its other names) and on `commit`, the commands AR0720 names. It passes every other command unchanged, and four of them make or bring an image with the labels they are given: `docker compose build` (`labels` under `build` in the compose file), `docker buildx bake` (a target's `labels`), `docker import --change 'LABEL arthur.container=<id>'`, and `docker load` or `docker pull` of an image that carries them. A container the owner starts from such an image then counts as the job's, at the prune and in the sweep, as before AR0720. [INFERENCE] from the documented behaviour of those commands; the fake docker models none of them, so no test shows it.
- Suggestion: decide it on the reading side, which covers every way an image is made, the API included: a container's mark counts only when its image does not carry the same value (`docker container inspect --format '{{.Image}}'`, then that image's labels), in the prune's listing and in `docker-look.ts`. It errs on the safe side: a job's container whose image carries the job's own mark is left, never the owner's removed. Out: images the owner builds himself.
- Status: deferred (client summary)

## F2. The sweep reads a container's labels from the listing's comma-joined text, so a label value that holds a comma reads as more labels

- Kind: fix
- Found by: 2026-11-17-worker-f36680a2 (worker), 2026-11-17
- Where: `packages/docker/src/docker-look.ts:44`
- What: `docker container ls --format '{{json .}}'` prints `Labels` as `k=v,k=v`, and `pairs` splits it at each comma. An image built from a Dockerfile with `LABEL note="x,arthur.container=<id>"` gives the owner's container from it a `Labels` text that `pairs` reads as `arthur.container=<id>`, after the empty one AR0720 adds, so the sweep counts that container as the job's and removes it once it is stopped and the job's record is gone. The same split reads the labels of networks and volumes. The prune is not touched by it: it filters in the daemon (`--filter label=...`, `{{if .Label "..."}}`). Seen by reading the code; no test covers it, as the fake keeps labels as the same comma-joined text.
- Suggestion: read each container's labels as JSON, `docker container inspect --format '{{.Id}} {{json .Config.Labels}}'` as the listing already does for images, and the same for networks and volumes; teach the fake to keep labels as a map.
- Status: deferred (client summary)

## F3. `docker commit` gets no `arthur.job` of its own

- Kind: fix
- Found by: 2026-11-17-worker-f36680a2 (worker), 2026-11-17
- Where: `packages/docker/src/docker-label.ts:73-78`
- What: a committed image keeps the container's labels, so one a job commits from its own container carries its `arthur.job` or its compose project, and the prune removes it. One it commits from a container it did not make (the owner's, another job's) carries no label of the job, or the other job's, and the job's own `--change 'LABEL arthur.job=<other id>'` is passed on: the image is then left at the job's prune, or removed with another job. `labelled(["commit", "-c", "LABEL arthur.job=x", "web"], id)` keeps that change (the test row with `mine` in `packages/docker/test/labels.test.ts` shows the changes of the job's own are kept).
- Suggestion: add `arthur.job=<id>` to the `LABEL` change the script appends on a commit, which is applied last and so wins.
- Status: deferred (client summary)

## F4. A change written to that end can still take both of the script's changes as its text

- Kind: security
- Found by: 2026-11-17-worker-f36680a2 (worker), 2026-11-17
- Where: `packages/docker/src/docker-label.ts:73-78`
- What: moby parses a commit's changes as one Dockerfile. The script's change goes last and twice, so a change of the job's that ends in a line continuation takes only the first copy. A change that opens two heredocs whose end line is the script's own change (`ONBUILD COPY <<"<that line>" <<"<that line>" /x`) would take both copies as their end lines, and the image would keep the marks. [INFERENCE] from buildkit's `frontend/dockerfile/parser/parser.go` (heredocs of `ONBUILD`); not run against Docker. Such a job has Docker itself, with which it can stop or remove any container of the owner's directly, so this adds no reach; it only means the script is a guard against accidents, not against a job that wants to mark an image.
- Suggestion: none while a job reaches Docker's daemon unsandboxed; F1's reading side would close it with the rest.
- Status: deferred (client summary)

## F5. adds to F4

- Kind: security
- Found by: 2026-11-18-review-2fe6f780 (review), 2026-11-18
- Where: `packages/docker/src/docker-label.ts:26`
- What: A Dockerfile that names its own frontend (`# syntax=<image>`) receives the `--label` values as frontend options and may ignore them, so a job's build can keep `LABEL` marks on purpose. Inference from how buildkit passes labels; not run.
- Status: deferred (client summary)
