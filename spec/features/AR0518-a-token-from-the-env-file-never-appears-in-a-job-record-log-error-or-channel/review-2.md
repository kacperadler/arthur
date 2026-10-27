# AR0518 - Review 2

- Job: 2026-10-27-review-394ca154
- Branch: arthur/2026-10-27-worker-28470be0
- Commit reviewed: 1ae4c3c2e529f9fd3a74b727c03aa57ca7a503bd
- Verdict: FAIL

## Final message

I'm failing this branch. One leak path remains, and it breaks the ticket's Goal that no env-file value ever lands in a job's record or log. Everything else in this round holds up: the checks reproduce, the worker's claims match, and every mutation I tried was caught.

## Findings

1. **`packages/core/src/machine-sync.ts:65-67` (reached through `jobs.ts:190`, `launchThere`): a job on another machine still writes raw env values into its record and log under the local home.** This is the worker's own F2, left open in `findings.md`. The remote record guards no env file (`machine.test.ts` shows its guarded keys are `install, ssh, systemd, gitconfig, gitxdg`), so the remote wrapper's `envFileNames` names nothing. A prepare's variables do reach that machine, sent on stdin (`launchThere(…, env)`). The sweep then copies the remote `log` and `result` into `home/jobs/<id>/` without naming them, even though the process doing the copying (`arthur run`, through `loadPlugins`) has `hide` available.
   - **Reproduced** with a temporary test added to `machine.test.ts`, then removed:
     - `setup({ hide: secretNames({ ARTHUR_TEST_TOKEN: "s3cret-t0ken-123" }) })`.
     - A prepare returning `ARTHUR_INSTALL: "echo installed with s3cret-t0ken-123"`.
     - A fake agent whose final message holds the value.
     - Then `spawn({ machine: "gpu" })`, wait for the job to end there, and `jobs.sweep()`.
   - **What the local home then held:**
     - `result`: `"Done with s3cret-t0ken-123."`
     - `log`: `install: echo installed with s3cret-t0ken-123`
   - **Why it fails the ticket:**
     - This is the Done-means scenario (an install from a prepare printing the token), run on a machine instead of locally. The Done-means check, "searches every file under the temporary home", would find the token.
     - Scope In asks for "one place that replaces known secret values … before a record, a log line … is written". The sweep is a core write of a record into the local home, so it is inside that scope.
     - Review-1 listed F2 as a non-blocking note. With this reproduction, it is a missing requirement against the Goal's "never".
   - **Fix:** F2's own suggestion, naming the copied files with the loading process's `hide` in `syncMachine`. It is about one line plus passing `hide` through.
   - **Docs:** `packages/core/docs/commands/config.md:18` says the agent's and the install's output and its final message are named in "a job's record and log". It names no exception for a job on another machine, so it misleads until this is fixed.

## Notes (not blocking)
- Review-1's four findings are resolved:
  - A setup error is now named (`host.ts`).
  - The 8-character limit is held by an exactly-8 value (`12345678`).
  - Split chunks go through `namedChunks` for the install and stderr.
  - The prompt is named both here and on the remote record.
- `host.ts:44` builds `hide` only from enabled plugins' variables, while the wrapper names every value in the env file (also noted in review-1).
- `printNames`' `uncaughtException` handler prints `error.stack` only. Node would also print `error.cause`, which is now dropped; that loses information but leaks nothing.
- The core budget went from 6345 to 6410 over three AR-D63 raises; the ticket has three AR-D63 Decision entries for them.
- F4 (`git-writes.ts`, an exported `GIT_CONFIG_*`) is outside this ticket.

## Checks run
- `npm ci`: OK. `npm run check`: tsc, no errors.
- `npm test`, with gpgSign turned off through `GIT_CONFIG_*`: 1214 tests, 1153 pass, 0 fail, 61 skipped. This matches the worker's claim.
- `node --test packages/core/test/secret-names.test.ts`: 5/5 pass.
- The machine test "the prompt a job on another machine gets names each env value, there as here": passes.
- Mutations, each restored with `git checkout -- <file>`. All were caught:

  | File | Mutations |
  |---|---|
  | `secret-names.ts` | `namedChunks` initial cut `+1`→`+2`; hold nothing; `uncaughtException` handler removed; exit code `1`→`0`; Buffer naming off; latin1/UTF-8 form replaced by the plain value; limit `>=8`→`>=9` and `>=7` |
  | `wrapper.ts` | install through `save` instead of `namedChunks`; `.finally(installed.end)` removed; stderr through `save`; `errors.end()` removed |
  | `host.ts` | setup-error `hide` removed |
  | `jobs.ts` | remote prompt unnamed; local prompt unnamed, against both `machine.test.ts` and the end-to-end test |

- F2 reproduction: the temporary test above. It printed the raw token in the local `result` and `log`, and was removed afterwards. `git status --short` is clean.

FAIL