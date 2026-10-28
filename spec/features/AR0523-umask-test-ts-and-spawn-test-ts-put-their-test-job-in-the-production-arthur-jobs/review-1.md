# AR0523 - Review 1

- Job: 2026-10-28-review-f31ae603
- Branch: arthur/2026-10-28-worker-32e5d3d8
- Commit reviewed: 25ae605e3b80ba7f6d9bcb4bd02f07f3684776c9
- Verdict: PASS

## Final message

I found no blocking findings. The branch does what AR0523 asks: tests that start a job through the `arthur` CLI now put it in the test kit's own slice, never in `arthur-jobs.slice`, and that slice is removed at the end.

- `packages/core/src/host.ts:43-44` takes the slice name from `ARTHUR_JOB_SLICE`. When that is unset or empty it uses `arthur-jobs`. A bad name stops the load before any setup runs.
- `packages/core/src/testing.ts:31` sets `ARTHUR_JOB_SLICE` to `jobSlice.slice` right after it clears every `ARTHUR_` variable. The code that stops and resets that slice when the process exits was already there, so the test's slice is removed at the end.
- Both named tests pass the kit's slice to the CLI: `umask.test.ts:34` and `spawn.test.ts:47,100,229`. The test at `spawn.test.ts:96-110` now checks that the fake `systemctl` and `systemd-run` received `<kit slice>.slice`.
- A search finds `arthur-jobs` in no test under `packages/*/test` or `test`. The fixture in `inside-job.test.ts` was changed to match.
- The worker also changed `job-control`, `model`, `job-records` and `secret-names` tests. Their final message gives the reason: the ticket's Goal covers every test that starts a job, and these run `arthur spawn` or `continue`.
- The `SLICE` constant was deleted from `job-scope.ts`. Its only user was `host.ts`, and the deletion keeps the core under its line budget without a raise.
- The production slice's limits are unchanged, as the ticket's Out says.
- `spawn.md`, `plugin-api.md` and the comment in `jobs.ts` document the variable.

## Notes (not blocking)
- **One uncaught mutation:** in `host.ts:44`, changing `^\w+(-\w+)*$` to `^\w+(-\w+)?$` passes `host.test.ts` (21 pass, 0 fail). That version would wrongly refuse a valid three-part name such as `a-b-c`. It refuses more names, not fewer, so it opens no hole. Adding a three-part name to the accepted values at `host.test.ts:325` would catch it. Changing it to `(-?\w+)*` is equivalent (still refuses `-a`, `a-` and `a--b`), so it is no finding.
- **Misleading message:** a bad name prints `arthur jobs: arthur.config.ts did not load:` before the `ARTHUR_JOB_SLICE: …` line, which points at the config when the problem is the environment. The message also names no next command.
- **Unguarded test edits:** nothing fails if a test's own `env` stops passing `ARTHUR_JOB_SLICE`. For example, removing it from `umask.test.ts:34` would go unnoticed. Only the systemd-run test in `spawn.test.ts` checks the slice it hands the CLI.

## Checks run
- `npm ci`: exit 0.
- `npm run check`: tsc passed.
- `npm test`: tests 1227, pass 1166, fail 0, cancelled 0, skipped 61. This matches the worker's numbers, including the structure and line-budget tests.
- Mutation, `host.ts` ignoring the variable (`const slice = "arthur-jobs"`): two tests failed, the `host.test.ts` slice test and the systemd-run test in `spawn.test.ts`.
- Mutation, name check disabled (`if (false)`): `host.test.ts` failed 1.
- Mutation, `||` changed to `??`: `host.test.ts` failed 1, on the empty value.
- Mutation, `(-\w+)*` changed to `(-\w+)?`: not caught (above). `(-?\w+)*`: not caught, but equivalent.
- Mutation, the line in `testing.ts` that sets the variable removed: the kit test in `testing.test.ts` failed 1.
- All mutations restored; `git status` is clean.
- CLI smoke run in a throwaway repo, then deleted, using `env -i … node packages/core/src/cli.ts jobs`:
  - `ARTHUR_JOB_SLICE=jobs.slice`: exit 1 with the refusal line.
  - `arthur_smoke`: `no jobs`, exit 0.
  - empty value: `no jobs`, exit 0.

PASS