# AR0282 - Review 1

- Job: 2026-10-22-review-ar0282-925165ec
- Branch: h/2026-10-22-ar0282-fc59140c
- Commit reviewed: c8205100640c69f06cd1b6d5c613209d8a0388c9
- Verdict: PASS

## Final message

## Review: AR0282 — branch h/2026-10-22-ar0282-fc59140c @ c820510

### Findings
None that block merge.

### Verification performed

**Diff scope**: single file, `packages/orchestration/test/decisions.test.ts` (44 ins / 4 del), matching the worker's claim and the ticket's Scope (test-only, no production code touched).

**Ticket match**: Done means requires a deterministic test holding `<home>/orchestration/decisions-<project>.lock` via `takeLock` from a child process, starting `arthur decision ask`, releasing, and asserting the ask waited (its record after the holder's marker), with the four-process test left as-is. The new test does exactly this; the four-process test's assertions/process logic are untouched — only its folder/config setup was factored into a shared `demo()` helper, which is in-scope refactor, not a behavior change.

**Mechanism check**: traced `packages/core/src/lock.ts` — `takeLock`/`withLock` both write `<path>.<pid>` via `own()` before attempting the lock; `withLock` unlinks it immediately once the lock is acquired, so while the holder owns the lock the asker's `<lock>.<pid>` file persists for the whole wait, giving the test's poll loop (`existsSync(lock.pid)`) a reliable, race-free signal that the asker is blocked. Fallback exits (`existsSync(file)` or `asker.exitCode !== null`) correctly prevent a hang if the lock is missing. Marker record (`DM-D1`, kind `question`, empty options) validated against `decision-log.ts`'s `problem()` checker — it is a well-formed `Ask` entry.

**Boundary**: child process imports `@arthur/core/lock` via `import.meta.resolve`, a published core export (`"./lock": "./src/lock.ts"` in `packages/core/package.json`). No plugin-to-plugin or path-into-core violation.

**Commands run in this worktree** (after `npm ci`):
- `npm run check` → no errors.
- `npm test` → `tests 1023 / pass 1023 / fail 0 / duration_ms 304202` (full run, matches worker's claim).
- New test alone, 15× with lock intact → 15/15 pass.
- Four-process test alone → still passes (`2549ms`).

**Mutation reproduction** (throwaway edits, reverted with `git checkout --`):
- Removed the `withLock` wrapper from `change` in `decision-log.ts` → new test failed 8/8 (and once standalone with full diff shown), with exactly the worker's claimed symptom: `actual [0,0,'DM-D1']` vs `expected [0,0,'DM-D2']`.
- Renamed the lock file prefix `decisions-` → `decisions2-` → failed 5/5.
- Restored source each time; `git status --short` clean before and after.

Both mutations, each a disabling of the exact behavior under test (lock held across `change`, lock path matching the one the test's holder takes), are caught deterministically — no gap found.

### Notes
- None outside the reviewed range worth flagging.

PASS
