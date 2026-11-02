# AR0512 - Review 1

- Job: 2026-11-02-review-3a8ff770
- Branch: arthur/2026-11-02-worker-fbcd0e18
- Commit reviewed: ced059b19627be467eea45cc598f1f922a2952e7
- Verdict: PASS

## Final message

No findings. The branch closes the hole the ticket describes. The env file the sandbox hides, and the places the worktree guard refuses, now come from `ARTHUR_GUARDED`. Each launch sets that variable with `guardedPlaces(config)`, in `packages/core/src/job-scope.ts:67`. The job writes its own record, but it cannot change the environment its runner gives the wrapper. Nothing reads the record's `guarded` file any more, and a spawn no longer writes one.

What the change covers:
- **Every way a run starts:** a spawn passes `{ folder, envFile }` (`jobs.ts:160`), and a local continue passes `steps.config` (`job-control.ts:137`). A spawn or continue on another machine (`remote-job.ts:58,74`) launches without a config, as the ticket expects, since there is no env file there.
- **Order:** `ARTHUR_GUARDED` is set after the prepares' variables, so a plugin cannot override it. `model.test.ts:155-160` tests this.
- **Both readers:** the wrapper (`wrapper.ts:65`) and the worktree guard (`worktree-guard.ts:33`) read the variable. `worktree-guard.test.ts:1197-1208` proves the guard ignores an emptied or planted record file.
- **The required test:** `sandbox.test.ts:541-560` empties `$ARTHUR_JOB/guarded`, continues the job, and checks four refused reads of the env file. It also checks that no record file holds the token. On this machine it runs; it is not skipped.
- **Files outside the ticket's Scope:** the worker also changed `job-scope.ts`, `jobs.ts`, `job-control.ts`, `remote-job.ts` and `worktree-guard.ts`. The Goal (the worktree guard, other machines) needs them, and the final message says why.
- **Docs:** `spawn.md` and `deploy.md` now describe `ARTHUR_GUARDED`. The only remaining source mentions of `guarded` are the tests that plant the file to prove it is ignored.
- **File sizes:** `wrapper.ts` stays yellow (218 → 217 lines), so no file moves into yellow or red. The structure test passes, so the core is within its line budget; the worker reports 7091 lines against 7092.

## Notes
- (minor) packages/core/src/job-control.ts:97: `config?` added to the type of `steps` only. This is the mutant that survived in the worker's mutate run; it changes nothing at runtime, so no test can catch it.
- (minor) packages/core/src/job-sandbox.ts:96: `hidden()` no longer reads the `install`/`config` exceptions from the record either. This is the right fix, but it was inferred from the code and has no test of its own.

## Checks
- `npm run check`: tsc passed.
- `npm test`: 1492 tests, 1428 pass, 0 fail, 64 skipped (412 s). No timing test failed, so `limits.test.ts` was not run alone.
- `node --test --test-name-pattern="across a continue" packages/core/test/sandbox.test.ts`: 1 pass, 0 skipped.
- Mutation by hand: I removed `steps.config` from the `launch` call in `job-control.ts:137`. The AR0512 test then fails (`actual: 2, expected: 4`). I restored the file with `git checkout`, and `git status --short` printed nothing.
- I did not run `npm run mutate` or `npm ci`. You asked me to keep this review small.

PASS