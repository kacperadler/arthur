# AR0329 - Review 1

- Job: 2026-10-23-review-ar0329-job-isolat-b49ac592
- Branch: h/2026-10-23-ar0329-job-isolation-192f7a0b
- Commit reviewed: bf52dfdf4e4b6fb35c2b0089830145357196bc96
- Verdict: PASS

## Final message

Worktree clean, no stray edits.

## Findings

None blocking.

## Notes

- `~/.gitconfig.d` and `~/.config/git/config` bypass `~/.gitconfig` matching (tested by the worker, documented as "Known limit"); not a Done-means gap since the ticket names `~/.gitconfig` specifically.
- `packages/core/src/jobs.ts` and `testing.ts` sit exactly at the 200-line budget (not over); fine.

## Checks run

- `npm ci`: clean, no errors.
- `npm run check`: passes, no tsc output.
- `npm test`: 1054/1054 pass, matches worker's claim exactly.
- Read `job-place.ts`, `worktree-guard.ts`, `job-record.ts`, `jobs.ts`, `host.ts`, `remote-job.ts`, `testing.ts` diffs in full; verified `jobRunner` signature change (`envFile` param) propagated to every call site (host.ts, testing.ts, remote-job.ts via `writeRecord(..., undefined)`, and all test files) — none missed.
- Verified `guardedPlaces`/`guarded()` parsing: `Object.hasOwn` (not `in`) blocks prototype-key bypass (`constructor`), `isAbsolute` blocks relative-path lines, `real()` resolves symlinks including a symlinked `HOME`.
- Verified `refusal()`'s innermost-wins sort correctly picks "Arthur's env file" over "the main checkout" when the env file sits inside the checkout, and "the main checkout" over "Arthur's install" when both paths are equal (self-dev scenario), matching the self-development Decision.
- Verified ticket's Decision (line-budget raise 5787→5815, +28) is recorded in `test/structure.test.ts` with reason, and the ticket itself records "Coordinator accepted core's line budget raise 5787 -> 5815".
- Verified F1 finding recorded in `findings.md` per ticket's Done-means split (guard now vs. real sandbox later), status `open`, matching Description's two-step split.
- Verified `docs/deploy.md` threat-model bullet updated to name the new guarded places and the `node -e`/`python3 -c`/`tar -C`/run-time-path bypasses; `packages/core/docs/commands/spawn.md` updated to document the `guarded` record file.
- Ran 4 targeted mutations in the worktree (restored after each via `git checkout --`):
  - Dropped `real(path)` in `guarded()` → caught by new SSH-folder test case.
  - `Object.hasOwn(GUARDED, key)` → `key in GUARDED` (prototype bypass) → caught, test showed refusal leaking `function Object() { [native code] }` as the place name.
  - Removed guard's `place.guarded` push in `refusal()` → caught by the self-development "plugin path" test (env-file write inside the checkout no longer named correctly).
  - `host.ts` passing `config.core.home` instead of `config.core.envFile` → caught by the new "env file outside the config folder" spawn test.
  All four mutations match entries in the worker's claimed mutation table and were independently caught by the stated tests.
- Confirmed coordinator-unaffected claim: `worktreeGuard`'s `ARTHUR_JOB` gating (`if (record === undefined || record === "") return;`) is untouched by this diff — the coordinator process, which sets no `ARTHUR_JOB`, remains ungated.

PASS
