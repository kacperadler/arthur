# AR0605 - Outcome

- Merged: 2026-11-05, `1cd256e9`
- Branch: arthur/2026-11-05-worker-96dd160c
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $2.51, reviews $0.82; review rounds 2

## What went in

- packages/core/src/type-check.ts: runs the `tsc` installed beside the config on the config and on each existing `project.config.ts` of the enabled `projects` plugin's `folders`, and returns its lines and whether it passed; prints one non-failing line when typescript is not installed.
- packages/core/src/config-check.ts: `configCheck` prints the type check's lines after the host's refusals and before the env lines, and fails on a type error.
- packages/core/docs/commands/config.md: describes the type check: which files it reads, which `tsc` it uses, the line format, that keys in different objects all show while one object shows only its first unknown key, the "not installed" line, that a type error fails the check but not the start, and the exit code.
- packages/core/docs/commands/setup.md: says `arthur setup`'s Config section does not run the type check.
- packages/core/docs/core.md: says `arthur config check` also type-checks the config and project files.
- packages/core/test/config-check.test.ts: expects the "not installed" line in bare folders; new tests for every error in one run, a correct config, which files are checked, and a failing `tsc` beside the config.
- packages/core/test/cli.test.ts: the expected `config check` output includes the "not installed" line.
- test/structure.test.ts: core line budget raised from 7210 to 7238.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1495/1566 passed.

## Left open

- Deferred (client summary): F1. `tsc` runs without a timeout
