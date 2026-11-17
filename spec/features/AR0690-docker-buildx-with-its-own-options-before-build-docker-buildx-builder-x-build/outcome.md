# AR0690 - Outcome

- Merged: 2026-11-17, `704153ee`
- Branch: arthur/2026-11-17-worker-f9047864
- Reviews: none
- Cost: worker $0.85, reviews $0.00; review rounds 0

## What went in

- `packages/docker/src/docker-label.ts`: skips buildx's own options (`--builder <name>`, `--builder=…`, `-D`, `--debug` and their `=` spellings) between `buildx` and `build`, so that build gets the job's label after `build` and loses every `arthur.job` word after it.
- `packages/docker/test/labels.test.ts`: a test with rows for buildx's own options before `build` (labelled, foreign label dropped) and before other buildx commands, a lone `--builder`, `-` and `--` (unchanged).
- `packages/docker/docs/docker.md`: one line saying buildx's own options before `build` stay where they are and the build is labelled.
- `test/structure.test.ts`: the docker package's line budget goes from 694 to 697, for the 3 lines this fix adds.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1814/1885 passed.

## Left open

- Findings: none; no findings.md on this ticket.
