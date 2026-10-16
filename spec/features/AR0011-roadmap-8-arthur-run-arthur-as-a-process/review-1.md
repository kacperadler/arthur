# AR0011 - Review 1

- Job: 2026-10-16-review-ar0011-arthur-run-c4658a69
- Branch: h/2026-10-16-ar0011-arthur-run-135ec570
- Commit reviewed: a28983c3c4cb7b77c559f06eedf7eb154550de58
- Verdict: PASS

## Final message

## Findings

None that block merge.

## Notes

- `lock.ts` changes for the later AR0036 merge: this branch (1) adds `takeLock(path)`, a long-held variant of the lock returning `{release}` or `{heldBy: pid}`, alongside the existing `withLock` (short-held, waits then throws); (2) changes the on-disk lock format from a bare pid to `"<pid> <bootId>"` on Linux, and changes `holder()` to treat a lock written in a different boot as stale. Both `withLock` and `takeLock` share the new `own()`/`bootId()` helpers. AR0036's merge must keep the new file format and the `thisBoot` staleness check in `holder()` for both lock functions to stay correct across a reboot.
- SIGINT handling is beyond the roadmap's literal "SIGTERM" wording; the worker discloses and justifies it (Ctrl-C in a terminal). Reasonable, not scope creep worth failing on.
- `systemd-analyze --user verify` on the doc's drop-in fragment alone fails with "Failed to prepare filename …: Invalid argument" — expected, `verify` requires a full unit file (`.service` suffix), not a `.conf` drop-in fragment; not a defect in the doc.
- Pre-existing `/tmp/arthur-test-*` folders accumulate across repeated `node --test` invocations (testing kit behavior, not part of this diff); cleaned up after my own runs, not a new leak introduced by this branch.

## Checks run

- `npm ci`, `npm run check` (tsc, no errors), `npm test`: 113/113 pass, matches worker's claim.
- `systemd-analyze --user verify` on the unit text extracted verbatim from `docs/deploy.md`: no errors (silent success), confirms worker's claim.
- Mutation testing (each reverted via `git checkout -- packages/core/src/run.ts` / `src/lock.ts` after observing failure):
  - Inverted the boot-id staleness check in `lock.ts` (`thisBoot = true`) → `lock.test.ts` and `run.test.ts`'s stale-lock tests failed as expected.
  - Removed the `if (signalled !== undefined) break;` guard in `run.ts`'s start loop → the "SIGTERM during a start" test failed (plugin `c` started after the signal, which the ticket's Done means forbids).
  - Removed `started.reverse()` → stop-order tests failed (plugins stopped in start order instead of reverse).
  - Changed the stop loop to `break` on a thrown `stop` instead of continuing → the "a stop that throws still stops the others" test failed (orchestration never stopped).
  - Removed the `keepAlive` `setInterval` (hypothesizing it was dead code since a signal listener alone kept a standalone script alive in a side experiment) → tests failed with an "unsettled top-level await" warning instead of a clean exit; confirms it's load-bearing, not needless complexity.
  - All mutations reverted; `git status --short` clean before verdict.
- Verified line counts: `packages/core/src/*.ts` totals 1337 lines, matching the worker's claim, under the 4000-line core budget; no `package.json` changes (no new runtime/dev deps).
- Spot-checked `docs/deploy.md`, `run.md`, `README.md`, `help.md`, `cli.test.ts` against the diff and the roadmap entry 8 text (Package, Delivers, Done means, Covers S7/S8/C4/C8) — all align; `spec/roadmap.md` and `arthur.config.example.ts` correctly left untouched (no new option).
- Confirmed no leftover production-named resources: no `arthur-smoke-ar0011` unit present, repo tree clean, no stray `.arthur`/`run.pid` files.

PASS
