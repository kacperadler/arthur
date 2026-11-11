# AR0645 - Outcome

- Merged: 2026-11-11, `7dd448d8`
- Branch: arthur/2026-11-09-worker-69fae305
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md FAIL, review-4.md PASS, review-5.md PASS
- Cost: worker $35.36, reviews $7.20; review rounds 5

## What went in

- spec/roadmap.md: entry 70 says an `arthur.job` word after the image is dropped too; entry 94's `arthur setup` example prints docker's real summary and option lines with their defaults.
- arthur.mmd: docker shown as partly built, one class line in main's sorted layout.
- arthur.config.example.ts: main's generic header; docker's options and `docker.project(false)` described.
- test/option-tables.test.ts: docker's options file in `PLUGINS` and its tool in `TOOLS`, in main's sorted layout.
- test/structure.test.ts: docker budget 275 (new), machines raised from 535 to 538.
- packages/docker/src/docker-label.ts: adds `--label arthur.job=<id>` after the command (past Docker's own options and a leading `--`); drops every word that sets `arthur.job`, wherever it stands.
- packages/docker/test/labels.test.ts: every spelling of an `arthur.job` word, each `--` and `--label` given as an option's value, words after the image and after `--`; the prepare, its refusals and limits.
- packages/docker/docs/docker.md: the plugin's page, the dropping of `arthur.job` words included.
- packages/core/src/job-sandbox.ts: `hidden()` shows a job its own `<home>/docker/jobs/<id>` once the docker prepare has made it; nothing else of the docker folder.
- packages/core/test/sandbox.test.ts: the AR0593 test also checks that the job reads and runs its own docker script from bash, and is denied another job's script and `docker/told`.
- packages/core/docs/commands/spawn.md: "The sandbox" names the job's own docker script folder as shown.
- packages/core/docs/commands/setup.md: the `arthur setup` example prints docker's real summary.
- packages/docker/package.json: the `@arthur/docker` workspace, exporting `.` and `./options`.
- packages/docker/src/docker.ts: the plugin: the prepare, `resources.disk` (Docker's data root, its call cut after 10 s; on macOS said once), doctor lines, `docker.project(false)`.
- packages/docker/src/docker-options.ts: the option table, summary and tools, the option check and the piece check.
- packages/docker/src/docker-prepare.ts: writes the job's script on its machine within 30 s and returns `PATH` and `COMPOSE_PROJECT_NAME`; says once per machine when docker is missing; its refusals, the time limit included.
- packages/docker/src/docker-doctor.ts: one doctor line per labelled machine, cut after 5 s: ok or rootless, the unsafe refusals, docker missing, down or timed out.
- packages/docker/test/fake-docker.ts: the fake `docker` and `ssh` in Docker v29's shapes.
- packages/docker/test/docker-shapes.json: the recorded keys and texts from docker/cli and moby v29.9.2.
- packages/docker/test/fake-shapes.test.ts: holds the fake to the recorded shapes.
- packages/docker/test/docker.test.ts: `resources.disk` and the doctor lines, with their 10 s and 5 s limits and the timed-out answers, and a data root that is not an absolute path.
- packages/docker/test/docker-options.test.ts: option limits and refusals, the piece, `arthur config check`, the example config's docker options.
- packages/machines/src/machines.ts: provides `machines.labels`.
- packages/machines/test/machines.test.ts: tests `machines.labels`.
- packages/machines/docs/machines.md: names `machines.labels`.
- packages/machines/docs/commands/machines.md: documents `machines.labels`.
- docs/plugin-api.md: rows for `machines.labels`, docker's `resources.disk` and docker's `doctor`; an AR0645 entry under "Changes since entry 51".
- docs/setup.md: the example's first missing package is now `@arthur/server`.
- README.md: a docker line "partly built"; the resources box updated; the Contributing line folded into another so the README stays at 120 lines or fewer.
- test/piece-order.test.ts: docker listed before projects still refuses a bad piece.
- package-lock.json: the docker workspace.
- spec/features/AR0645-docker-w2-the-docker-plugin-labels-what-a-job-creates-and-machines-gives-its/findings.md: F1 (fixed in 4cf5156c); F2, image commands outside roadmap 70's list get no label (open).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1649/1720 passed.

## Left open

- Deferred (client summary): F2. Some commands that make images get no label: builder build, buildx b, commit, image import
- Deferred (client summary): F3. buildx's own options before `build` hide the command, so no label is added and a foreign one stays
