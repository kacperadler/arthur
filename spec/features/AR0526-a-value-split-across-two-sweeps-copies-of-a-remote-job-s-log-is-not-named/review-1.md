# AR0526 - Review 1

- Job: 2026-10-29-review-6e766e16
- Branch: arthur/2026-10-29-worker-4242e88a
- Commit reviewed: 3b1ad6d47a90c3a2a8e981660c75b90bd3ad1e5e
- Verdict: FAIL

## Final message

The branch implements the fix the ticket asked for, and `npm run check` and `npm test` both pass. It fails on one key code path that no test covers.

## Findings

1. **`packages/core/src/machine-sync.ts:64`: no test checks the hold on the first copy of a log.** This is the `logFrom === 0` branch, used the first time a job's log is copied or when the log there is now shorter than the byte asked for.
   - **Mutation not caught:** I changed `write(folder, "log", hide(log.slice(0, log.length - rest.length)))` to `write(folder, "log", hide(log))`. The two new tests, the ">1 MiB" test and every test in `packages/core/test/machine*.test.ts` and `remote*.test.ts` still pass (45 tests, 44 pass, 0 fail).
   - **Why it matters:** with the hold gone on this path, a first copy that ends inside a value writes the start of the value unnamed. Because `synced` still records where the held line starts, the next copy sends that line again, so the local log gets the value both cut and named, plus duplicated text. That is the exact leak the ticket is about, on the copy every remote job goes through first.
   - **Why the tests miss it:** both new tests run their first `jobs.sweep()` while the log ends on a line break. The hold is only exercised on the append path at line 63.
   - **Fix:** a test whose remote log holds an unfinished line containing part of a value before the first copy.

## Notes (not blocking)

- **Gap left open:** the ticket's goal says "whatever the copy's cut", but a value cut inside a single line longer than 256 KiB still arrives unnamed. That gap comes with the approach the ticket itself suggests (copy up to the last line break). The worker documents it in `config.md` and filed it as F1 in `findings.md` (`Status: open`). The fix it suggests, carrying the values through the bus's `hide`, needs `events.ts`, which is outside the ticket's files.
- **Wrong start byte after invalid UTF-8:** line 65 computes the next start with `Buffer.byteLength(rest)` on text already decoded from bytes. If the held line has invalid UTF-8, each bad byte decodes to U+FFFD (3 bytes), so the next copy starts too early and the local log repeats a few bytes. No value leaks this way; the remote side already cuts at character boundaries.
- **Multi-line values:** a value set in the shell that contains a line break can still be cut at the "last line break". Values from the env file are single-line, so it doesn't apply to them.
- **Narrow race:** if `records` reads `blocked`, then an `arthur continue` there restarts the agent before the log is read, an unfinished line would be copied whole because the job counts as ended. In normal runs the wrapper's `note` always ends the log with a line break before the state is written, so this is very unlikely.
- `spawn.md` was changed outside the ticket's file list; the final message gives the reason. Line 62 is a very long one-line expression, which no rule forbids.

## Checks run

- `npm run check`: tsc clean.
- `npm test`: tests 1278, pass 1216, fail 0, skipped 62. This matches the worker's numbers; nothing in `limits.test.ts` failed.
- Targeted run of the two new tests and the ">1 MiB" test on the unchanged branch: 3 of 3 pass.
- Mutations, each run on its own and restored with `git checkout --`:

| Mutation | Result |
|---|---|
| No hold (`rest = ""`) | Both new tests fail |
| Drop `ended &&` | Test 1 fails |
| Drop `copy.logTo === copy.logSize` | Test 2 fails |
| Drop the no-line-break fallback | The ">1 MiB" test fails |
| Fallback `<` changed to `<=` | Test 1 fails |
| `synced` takes `copy.at` (the newest time) | Test 1 fails |
| `rest.length` instead of `Buffer.byteLength(rest)` | Test 1 fails |
| No hold on the first-copy path, line 64 | **Not caught by any machine test** |

  - Every mutation the worker listed reproduced as claimed. My first two runs were done in parallel on the same file and their results were mixed up, so I reran both alone; those reruns are what the table shows.
- `git status` is clean after the restores.

FAIL