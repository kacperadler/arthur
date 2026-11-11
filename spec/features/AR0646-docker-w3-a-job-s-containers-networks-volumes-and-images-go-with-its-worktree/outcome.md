# AR0646 - Outcome

- Merged: 2026-11-11, `d2435dcf`
- Branch: arthur/2026-11-11-worker-48cf9b11
- Reviews: review-1.md PASS
- Cost: worker $8.73, reviews $1.52; review rounds 1

## What went in

- README.md: the docker line says a job's Docker resources go with its worktree and the sweep comes next.
- arthur.config.example.ts: the docker comments say the cleanup is built and only the sweep and `arthur.keep` are planned; `docker.project(false)` also skips the cleanup.
- arthur.mmd: the docker node shows "cleanup with the worktree", sweep planned.
- packages/core/docs/commands/prune.md: the hook-text example is the docker plugin's real line.
- packages/docker/docs/docker.md: new section "At each prune" (steps, the line, refusals, the notices given up with); intro, options and the piece updated.
- packages/docker/src/docker-cleanup.ts: new; the `jobs.cleanup` hook that lists, stops and removes a job's Docker resources, names refusals, cuts the build cache, removes the script folder, and returns one line.
- packages/docker/src/docker.ts: the cleanup's own check of which jobs are its (project not off, labelled machine); registers the hook with `buildCache`.
- packages/docker/test/cleanup.test.ts: new; the cleanup with real Git through the fake host's spawn and prune, plus the hook called directly for each edge case.
- packages/docker/test/docker-shapes.json: Docker's removal-refusal texts, buildx's `Total:` line, the legacy builder's flag error, and their sources.
- packages/docker/test/fake-docker.ts: the fake answers label filters, stop and rm with Docker's refusals, a computed `system df`, buildx prune, a daemon crash mid-run, and the legacy builder.
- packages/docker/test/fake-shapes.test.ts: holds the computed `system df` to its shape; buildx's prune line.
- spec/features/AR0646-docker-w3-a-job-s-containers-networks-volumes-and-images-go-with-its-worktree/findings.md: new; F1.
- test/structure.test.ts: docker line budget 275 → 393.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1669/1740 passed.

## Left open

- Deferred (client summary): F1. A slow `docker system df` can keep a machine's jobs from ever being cleaned
- Deferred (client summary): F2. no test catches the removal of the listing's error exit
- Deferred (client summary): F3. images are removed by ID
