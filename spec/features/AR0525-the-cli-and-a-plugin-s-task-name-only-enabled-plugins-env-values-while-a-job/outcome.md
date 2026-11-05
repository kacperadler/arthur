# AR0525 - Outcome

- Merged: 2026-11-05, `caf3936c`
- Branch: arthur/2026-11-05-worker-80a33a81
- Reviews: review-1.md PASS
- Cost: worker $1.61, reviews $0.37; review rounds 1

## What went in

- `packages/core/src/host.ts`: `hide` names every value of the config's env file outside a job, plus the enabled plugins' values (the shell's included); inside a job, only the plugins' values.
- `packages/core/src/secret-names.ts`: `secretNames` accepts a record or `[name, value]` pairs; `envFileNames(files, named)` names every value of the files plus `named`.
- `packages/core/test/host.test.ts`: new test that `hide` names a disabled plugin's, no plugin's and a shell-overridden file value, and that inside a job it names none of the file's.
- `packages/core/test/secret-names.test.ts`: the CLI test's env file adds a disabled plugin's value and a no-plugin value; the exception, rejection and stdout bytes must show their names, never the values.
- `packages/core/docs/commands/config.md`: says every env file value, under any name, and each enabled plugin's shell variable is named.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1492/1563 passed.

## Left open

- Deferred (client summary): F1. plugins' `[redacted]` still uses `host.secrets`, which holds only enabled plugins' values
