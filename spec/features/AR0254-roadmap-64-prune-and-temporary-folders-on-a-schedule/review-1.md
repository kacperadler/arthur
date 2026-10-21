# AR0254 - Review 1

- Job: 2026-10-21-review-ar0254-roadmap-64-8af3550d
- Branch: h/2026-10-21-ar0254-roadmap-64-prune-bd13280b
- Commit reviewed: 6901128492b4d2e8a98c815cb0c652289870aa11
- Verdict: FAIL

## Final message

## Findings

**`packages/manage/test/cleanup.test.ts:70-89,92-98` — two tests run the production cleanup against the real system `/tmp`, not a test-owned folder.**

`cleanup()` (`packages/manage/src/cleanup.ts:41-61`) always runs *both* parts — the job prune and the temporary-folder sweep — in one call; they are not separately invokable. The schedule-registered `run` closure calls `cleanup(host, keepDays, tmpdir(), ...)`, where `tmpdir()` is `node:os`'s real OS temp dir (`/tmp` unless `TMPDIR` is set).

- `load()` (`cleanup.test.ts:24-31`) never touches `process.env.TMPDIR`.
- The tests "the run frees each job that ended keepJobsDays days ago or longer…" (line 70) and "keepJobsDays 0 frees every ended job…" (line 92) call `entries[0].run()` directly (lines 79, 88, 97) — invoking the real `cleanup()` with the real `os.tmpdir()`.
- Only the third test ("the run removes the arthur-* folders…", line ~101) redirects `process.env.TMPDIR` before calling `run()`, and restores it afterward. The two job-prune tests get no such protection, even though they execute the same `run()` that also sweeps temp folders.

I reproduced this directly: created `/tmp/ar64-scratch-tmpdir/arthur-sentinel-other-job/` (mtime 3 days old, standing in for another process's real leftover folder — exactly what the 43 genuine `arthur-test-*` directories already sitting in this box's real `/tmp` are), set `TMPDIR` to that scratch dir only to keep the *real* `/tmp` safe during my check, and ran `node --import @arthur/core/testing --test packages/manage/test/cleanup.test.ts`. All 7 tests passed, and the sentinel folder was deleted as a side effect — confirmed by `ls` before/after. Had I run `npm test` unmodified (as the worker's own instructions describe and as CI would), the same sweep would have run against the box's actual `/tmp`, which already holds 43 real `arthur-test-*` directories from other concurrent jobs, several with mtimes >1 day old. Running the test suite as shipped would permanently delete other jobs' real temporary data on this shared workstation.

This is exactly the family the review's Focus item names ("tests use their own tmpdir, never the real /tmp") and the review guide's FAIL bullet ("a fixed `/tmp` path"). It's worse than a naming collision: the test actively deletes real resources it does not own, every time it runs un-isolated.

The worker's final message claims "`npm test`: 888 passed, 0 failed" and describes careful isolation ("The scratch folder is deleted") for the *manual* verification script, but never isolates these two automated tests from the real `/tmp`.

## Mutation checks (confirms the rest of the suite's coverage is otherwise solid)

Ran with `TMPDIR` redirected to a scratch dir to avoid touching the real `/tmp`:
- Inverted the other-user check (`stat.uid !== uid` → `=== uid`) in `cleanup.ts:22` — caught by "a folder another user owns is kept…" (2 assertion failures).
- Removed the running-job cutoff (`Math.min(now - DAY_MS, ...runs)` → `now - DAY_MS`) in `cleanup.ts:58` — caught by "a folder made since a running job's current run began stays…".
Both mutations reverted with `git checkout --`; working tree confirmed clean afterward.

## Notes

- `host.jobs.prune(ids)` addition to core is minimal, matches `docs/plugin-api.md`'s "Changes since entry 51" convention, `--all` correctly stays CLI-only via the type signature.
- Budgets, README/`arthur.mmd` status lines, and `docs/manage.md`/`docs/plugin-api.md` updates all match the diff and pass `structure.test.ts`.
- Schedule's "one missed run at start" semantics are pre-existing (`schedule/src/sweep.ts`); manage's `run` entry correctly reuses them, not reinvented.

## Checks run

- `npm ci`: clean (in this worktree).
- `npm run check`: clean (tsc, no errors).
- `npm test` (full suite, with `TMPDIR` redirected to a scratch dir to avoid the bug above hitting the real `/tmp`): 888/888 passed, matching the worker's claim — but this required bypassing the isolation flaw myself; an unmodified `npm test` run would exercise the real-`/tmp` deletion described above.
- `node --import @arthur/core/testing --test packages/manage/test/cleanup.test.ts` in isolation (TMPDIR-protected): 7/7 passed.
- Reproduced real-`/tmp`-deletion side effect via sentinel directory (see Findings).
- Two mutation checks on `cleanup.ts` (other-user check, running-job cutoff): both caught by existing tests, reverted cleanly.

FAIL
