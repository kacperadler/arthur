# AR0720 - Outcome

- Merged: 2026-11-18, `49caf384`
- Branch: arthur/2026-11-17-worker-f36680a2
- Reviews: review-1.md PASS
- Cost: worker $12.01, reviews $1.21; review rounds 1

## What went in

- `packages/docker/src/docker-label.ts`: sets both container marks empty on every build (its two other names included) and, by two last `--change` words before the container, on every commit; drops config-hash labels on a build.
- `packages/docker/src/docker-cleanup.ts`: lists a compose container only when its config hash is not empty, each listing ending the call when Docker refuses it.
- `packages/docker/src/docker-look.ts`: reads an empty `arthur.container` or config hash on a container as none.
- `packages/docker/test/fake-docker.ts`: the fake builds and commits images with their labels, reads `--label-file` on `run` and `create`, and answers the `{{if .Label …}}` format.
- `packages/docker/test/docker-shapes.json`: records the sources read for build and commit, and Docker's five new refusal texts.
- `packages/docker/test/fake-shapes.test.ts`: tests the fake's build, commit, `--label-file` and label format against the recorded shapes.
- `packages/docker/test/labels.test.ts`: tests what a build and a commit get, in each spelling and option position.
- `packages/docker/test/cleanup.test.ts`: tests that the prune leaves the owner's containers from job-made images and removes the job's own, and that each refused listing ends the cleanup.
- `packages/docker/test/sweep.test.ts`: tests the same for the sweep of a gone job.
- `packages/docker/docs/docker.md`: says what an image a job makes never carries, how build and commit are rewritten, and what is not covered.
- `packages/docker/docs/commands/docker.md`: says a container counts by neither mark when empty.
- `spec/roadmap.md`: entries 70 and 71 name the empty marks and the build's other names.
- `spec/features/AR0720-a-job-image-that-carries-arthur-container-or-a-compose-project-with-its-config/findings.md`: F1 to F4, open.
- `test/structure.test.ts`: the docker line budget is 745.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1831/1902 passed.

## Left open

- Deferred (client summary): F1. An image a job makes past `build` and `commit` still carries a container's marks
- Deferred (client summary): F2. The sweep reads a container's labels from the listing's comma-joined text, so a label value that holds a comma reads as more labels
- Deferred (client summary): F3. `docker commit` gets no `arthur.job` of its own
- Deferred (client summary): F4. A change written to that end can still take both of the script's changes as its text
- Deferred (client summary): F5. adds to F4
