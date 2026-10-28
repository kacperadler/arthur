# AR0523 - Outcome

- Merged: 2026-10-28, `088fb76b`
- Branch: arthur/2026-10-28-worker-32e5d3d8
- Reviews: review-1.md PASS
- Cost: worker $4.22, reviews $0.86; review rounds 1

## What went in

- The jobs' systemd slice now comes from `ARTHUR_JOB_SLICE` (default `arthur-jobs`; a bad name stops the load), and the test kit sets it to its own slice, so a test that starts a job through the `arthur` CLI never runs in the production `arthur-jobs.slice`, and the kit removes its slice at exit.
- Every CLI test that spawns or continues a job passes the kit's slice; the systemd-run test checks the slice its fakes receive. `spawn.md` and `plugin-api.md` document the variable.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1161/1228 passed.

## Left open

- Findings: F1 to F3 dropped (see findings.md).
