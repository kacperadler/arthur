# AR0070 - Review 1

- Job: 2026-10-16-review-ar0070-continue-k-33ae1c45
- Branch: h/2026-10-16-ar0070-continue-killed-b-771a00d8
- Commit reviewed: eb56c352a162a799b800cc924b6a63ef39349b0d
- Verdict: FAIL

## Final message

## Review: `h/2026-10-16-ar0070-continue-killed-b-771a00d8` @ `eb56c35`

### Findings

**`packages/core/src/job-control.ts:95-96` — the new "wait until running (or wrapper gone)" loop is untested; removing it changes no test outcome.**
This loop is the piece the worker's own final message calls essential ("Without that wait, a continue that exits normally would leave a dead-pid lock while the record still shows the old final state, and a second continue could take it over then"). It closes a real gap: once `launch()` returns (wrapper wrote `pid`), without this wait `continueJob` returns immediately; the calling CLI process can exit before the wrapper writes `state: running` and removes `continuing`. In that window `continuing` holds the now-dead CLI process's pid — a second `continue` would see a dead holder and take the lock over at once, racing the still-running wrapper, exactly the hazard the ticket is about.

I mutated the code (deleted the comment + `while` loop, leaving plain `return failed;`), restored afterward with `git checkout -- packages/core/src/job-control.ts`:
```
npm run check  → clean
npm test       → 269/269 pass, 0 fail
```
Every test still passes with the behavior removed. No test asserts on the timing of `continueJob`'s return relative to `state`/`continuing` (the new `job-control.test.ts` test only checks outcomes after the job has fully ended, long after `continuing` is gone either way). Per the review guide this is a FAIL on its own: "A mutation of a key behavior … that the tests do not catch is the same FAIL." This is also exactly what the task's Focus asked to check ("look for a bounded wait, test it if not tested") — it is not tested.

The loop itself is bounded (verified by reading): it ends on `state === "running"`, or on `wrapperRuns(...)` going false (wrapper exited/crashed), so it cannot hang — that part is sound. The gap is purely test coverage of a safety-critical new behavior.

### Other mutations run (for corroboration of the worker's claims — all caught, no issue)
- Removed takeover (reverted `takeLock` to old `mkdirSync`-style refusal) — not independently re-run, but live-holder-refusal mutation below exercises the same code path.
- Disabled live-holder refusal in `takeLock` is not directly what I mutated; instead I disabled `lock.release()` in `continueJob`'s `finally` (`if (false) lock.release()`): 5 existing tests failed (`two continues at once …` ×2, `continue is refused …`, `a continue goes through the plugins' beforeSpawn …`, `a continue whose wrapper does not start …`). Restored via `git checkout -- packages/core/src/job-control.ts`. Confirms the release-on-failure path is well covered.
- `lock.ts` `takeOver`'s `rmSync(path, { recursive: true, force: true })` → `{ force: true }`: caught immediately by the new `lock.test.ts` folder-takeover test (`ERR_FS_EISDIR`). Restored via `git checkout -- packages/core/src/lock.ts`.

### Notes (non-blocking)
- F1 in the ticket's `findings.md` (continue killed between the wrapper's `pid` and `state` writes) is accurately described, correctly scoped out, and left `open` for a planning ticket — consistent with the worker's final message.
- `continue.md` wording matches the new return point and refusal text.
- Core line budget (4372) unchanged; `packages/core/src/` totals 4254 lines, under budget.

### Checks run
- `npm ci`: installs cleanly (5 packages).
- `npm run check` (clean tree): clean, no errors.
- `npm test` (clean tree): 269 tests, 269 pass, 0 fail.
- Mutation 1 (wait loop removed): 269/269 pass — **not caught**.
- Mutation 2 (`lock.release()` disabled): 5 tests fail — caught.
- Mutation 3 (`rmSync` without `recursive`): 1 test fails with `EISDIR` — caught.
- All mutations reverted; `git status --short` clean before verdict.

FAIL
