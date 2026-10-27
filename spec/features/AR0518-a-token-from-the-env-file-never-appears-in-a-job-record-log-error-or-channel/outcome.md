# AR0518 - Outcome

- Merged: 2026-10-27, `3b00352d`
- Branch: arthur/2026-10-27-worker-28470be0
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md FAIL, review-4.md PASS, review-5.md PASS
- Cost: worker $21.03, reviews $4.81; review rounds 5

## What went in

- `packages/core/src/secret-names.ts` (new): names each env value in text by its variable's name (values of 8 characters or more), across chunks split mid-value, in bytes (UTF-8 matched, a cut character kept) and in the CLI's stdout and stderr; the CLI prints an uncaught error or unhandled rejection named and exits 1.
- `packages/core/src/host.ts`, `events.ts`, `event-log.ts`: the loading process builds the namer, and the event bus and its log name every event, setup error and task message before they are written or sent to a channel.
- `packages/core/src/wrapper.ts`, `job-install.ts`: a job's own log, result, install output and stderr are named with every value of the env file, split chunks included.
- `packages/core/src/jobs.ts`: the prompt kept in a job's record, here and on another machine, is named.
- `packages/core/src/machine-sync.ts`: the sweep names the run files, the log (whole and appended) and the reason it copies from another machine, inside AR0509's bounds.
- `packages/core/src/cli.ts`: the CLI's output goes through the namer.
- `packages/core/test/secret-names.test.ts`, `machine.test.ts`, `sandbox.test.ts`: no raw value under the home, in output or a channel, for local and remote jobs, split chunks, bytes and uncaught errors.
- `packages/core/docs/commands/config.md`, `docs/plugin-api.md`: where a value never goes, and the gaps left (a value split across two writes of the CLI, or across two sweeps' copies).
- `test/structure.test.ts`: core line budget 6414 (policy AR-D63).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1155/1222 passed.

## Left open

- Tickets from findings: AR0524 (F4), AR0525 (F5), AR0526 (F6).
