# AR0439 - Outcome

- Merged: 2026-10-26, `fa0bdf8c`
- Branch: arthur/2026-10-26-worker-c54d4fe8
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $1.56, reviews n/a; review rounds 2

## What went in

- `packages/core/src/requirements.ts`: `coreRequirements` takes the environment (default `process.env`) and adds one non-critical `core provider key <VAR>` line for each of 19 known model provider keys set and non-empty in Arthur's environment, which every job inherits; it names the variable, never its value, and points to omp's own login or the models plugin's `prepare`. `arthur run` prints it at start and sends it at most once a day; it never refuses the start.
- `packages/core/docs/commands/doctor.md`, `docs/deploy.md`: the line, the keys, and the threat it names.
- Tests: `packages/core/test/doctor.test.ts` (one key one line, two keys two lines, none or empty no line, the value never printed). Core line budget 6228 to 6238 (AR-D61).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1160/1166 passed.

## Left open

- F1: dropped under AR-D53 (see findings.md). Jobs still receive the key; dropping it at launch was out of scope.
