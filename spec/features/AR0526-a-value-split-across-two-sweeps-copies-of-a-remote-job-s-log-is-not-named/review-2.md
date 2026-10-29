# AR0526 - Review 2

- Job: 2026-10-29-review-05032813
- Branch: arthur/2026-10-29-worker-4242e88a
- Commit reviewed: c6957d05365c0fcf26051352852e804f605f746a
- Verdict: PASS

## Final message

I found no blocking findings. Commit `c6957d05` fixes review 1's one finding, and every check and mutation I ran gave the result the worker reports.

## Findings

None.

## Notes (not blocking)

- **Review 1's finding is fixed.** The new test in `packages/core/test/machine.test.ts`, "a copy that brings the log from its first byte…", covers the full-log write at `packages/core/src/machine-sync.ts:64`. It checks both the first copy of a log and a log rewritten shorter than the byte asked for. I reran the reviewer's mutation, `write(folder, "log", hide(log))`: this test fails and the other 44 in the file pass.
- **One gap stays, by design of the ticket's own suggested fix.** The ticket's Done means says `config.md` no longer lists the gap. It still lists a narrower one: a value cut inside a single line longer than 256 KiB. That line is copied whole, otherwise the copy would never move on. It comes with "copy only up to the last newline", is stated in `config.md`, and is filed as F1 in `findings.md` (`Status: open`) for the coordinator to settle.
- **`packages/core/docs/commands/spawn.md` is outside the ticket's file list.** It gains one sentence that describes the new copy behaviour, which makes the page match the code. Review 1 accepted the reason the worker gave earlier; the latest final message doesn't repeat it.
- **Review 1's other notes still hold.** None of them leaks a value:
  - Invalid UTF-8 in a held line makes the next copy start a few bytes early and repeat them.
  - A shell value containing a line break can still be cut.
  - An `arthur continue` there could race with the copy, which is very unlikely.
- **Timing in the new tests is sound.** The new test waits on `starts(agent).length === 1`, the very state it asserts, not on a fixed time. Its gate file sits in `temporaryFolder()`, not under a production name.

## Checks run

- `npm ci`: succeeded.
- `npm run check`: tsc clean.
- `npm test`: 1279 tests, 1217 pass, 0 fail, 62 skipped, the same numbers the worker reports.
- Mutations, each applied alone in `machine-sync.ts` and restored with `git checkout --`; `git status --short` was empty at the end:

| Mutation | Result |
|---|---|
| No hold on the first-copy write (`write(folder, "log", hide(log))`) | New first-byte test fails (whole file: 44 pass, 1 fail) |
| No hold at all (`rest` always `""`) | All 3 new tests fail |
| Drop `ended &&` | First-byte test and still-writing test fail |
| `synced` always `${copy.at}:${copy.logTo}` | All 3 new tests fail |
| `rest.length` instead of `Buffer.byteLength(rest)` | Still-writing test fails (its line holds `✓`) |
| No-line-break fallback replaced by `false` | ">1 MiB arrives whole" test fails |

PASS