# AR0647 - Outcome

- Merged: 2026-11-12, `cc86eb39`
- Branch: arthur/2026-11-11-worker-5f2781a0
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS
- Cost: worker $21.74, reviews $4.95; review rounds 3

## What went in

- README.md: docker's line names the sweep and `arthur docker`, and that `docker.project({ service })` is held out.
- arthur.config.example.ts: docker comments describe the built sweep, its limit on unlabelled leftovers, and `arthur docker`.
- arthur.mmd: the docker node shows "sweep, arthur docker".
- docs/plugin-api.md: `schedule.register` lists docker among its consumers.
- packages/docker/docs/docker.md: intro and options cover entry 72; new section "The sweep"; unlabelled resources line corrected.
- packages/docker/docs/commands/docker.md: new; `arthur docker` page.
- packages/docker/docs/commands/docker-sweep.md: new; `arthur docker sweep` page.
- packages/docker/src/docker-cleanup.ts: reuses `why`, `sections`, `json`, `KINDS` and `count` from docker-look.ts; exports `bytes` and `human`.
- packages/docker/src/docker-command.ts: new; registers `arthur docker` (usage per machine) and `arthur docker sweep` (by hand, `--machine`, `--dry-run`, refusals).
- packages/docker/src/docker-look.ts: new; one listing of what Docker holds on a machine (objects, labels, owning job, clock, data root, `system df`, script folders) and the shared parsers.
- packages/docker/src/docker-options.ts: `leftoverHours` and `sweep` texts state the approved limit and the sweep by hand.
- packages/docker/src/docker-sweep.ts: new; the sweep: what goes and why, dry run, removal, cache prune and cut, free disk and floor, per-machine lock, one notice per sweep; its comment says what a throw and a lock wait cost.
- packages/docker/src/docker.ts: `after` schedule, the `sweep.at` schedule entry (refused without schedule), the `disk-low` handler while `arthur run` runs, the command.
- packages/docker/test/docker-shapes.json: records `info.SystemTime`, `image inspect`'s `.Id` and `.Config.Labels`, and their sources.
- packages/docker/test/fake-docker.ts: the fake answers the sweep's calls, keeps a clock and the cache's last use, and can stop Docker on one host.
- packages/docker/test/fake-shapes.test.ts: holds the new answers to the recorded shapes, the clock as RFC 3339.
- packages/docker/test/sweep.test.ts: new; tests the sweep, `arthur docker`, the schedule entry, load order, disk-low, every cause of the notice, a machine without docker as no failure, created, dead and paused containers, an image pulled by digest, offline and stopped machines, serialisation, half-way failures, cache options and refusals.
- spec/roadmap.md: entries 70 and 72 and the setup example state the approved limit on unlabelled leftovers.
- spec/features/AR0647-docker-w4-the-daily-sweep-of-docker-leftovers-arthur-docker-and-arthur-docker/findings.md: new; F1 the vision's lines 161 and 167, F2 herdr (dropped), F3 the lock wait, F4 images with several tags, F5 commas in label values, F6 labels a container inherits from a job's image, F7 two homes on one Docker host.
- test/structure.test.ts: docker line budget 694.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1690/1761 passed.

## Left open

- Deferred (client summary): F1. The vision still says the sweep removes unlabelled stopped containers and anonymous volumes
- Deferred (client summary): F3. A sweep's lock held past its 12-minute wait stops the sweep of every machine after it
- Deferred (client summary): F4. An image with several tags is listed once per tag and removed by its ID, which Docker refuses
- Deferred (client summary): F5. A label value with a comma splits into extra keys
- Deferred (client summary): F6. The owner's container from an image a job built carries the job's label, so the sweep takes it once the job is gone
- Deferred (client summary): F7. Two Arthur homes on one Docker host sweep each other's resources
