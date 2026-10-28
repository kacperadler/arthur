# AR0532 - Review 1

- Job: 2026-10-28-review-08853e13
- Branch: arthur/2026-10-27-worker-96067971
- Commit reviewed: 9c2a05ef9a835004535f79ea4363e9c08957311b
- Verdict: FAIL

## Final message

I checked the escape against omp's source and it holds up, but this is a FAIL. The new test only checks 4 of the 9 characters the escape covers. You can delete any of the other 5 from the pattern and the test still passes, which brings back the file read.

## Findings

1. **`packages/orchestration/src/hand-over.ts:14`: the test misses most of the characters the escape covers.** The escape puts a word joiner before an `@` that comes after one of `( [ { < " ' `` ` ``, or after whitespace or the start of a line. I removed each one from the pattern and ran the new test in `packages/orchestration/test/inbox.test.ts` each time:

   | Removed from the pattern | Test result |
   |---|---|
   | `^` (start of line) | fails (caught) |
   | `\s` (whitespace) | fails (caught) |
   | `(` | fails (caught) |
   | `` ` `` | fails (caught) |
   | `[` | **passes (not caught)** |
   | `{` | **passes (not caught)** |
   | `<` | **passes (not caught)** |
   | `"` | **passes (not caught)** |
   | `'` | **passes (not caught)** |
   | the whole escape | fails (caught) |

   - Each uncaught removal brings back the security bug: omp's own check (`uHa = /[\s([{<"'`]/`) would again read the file in text like `"@/etc/passwd"`, `'@.env'`, `<@~/.ssh/id_ed25519>`, `[@x]` or `{@x}`.
   - The test's `"@\"/home/me/my notes.md\"` and `@'.env'` cases only cover a path written inside quotes. In both, the `@` follows a space, so the quote characters are never checked as the character before `@`.
   - The worker says the cases are "quoted with "…" and '…'", which reads as if quotes before the `@` were covered. They are not.
   - The review criteria count an uncaught mutation of a key behavior as a FAIL.
   - **Fix:** add one case per character to the test text: `"@a"`, `'@a'`, `<@a>`, `[@a]`, `{@a}`.

## Notes (not blocking)

- **The worker's reading of omp 18.3.0 is right.** I read the source bundled in `~/.local/bin/omp` myself:
  - The pattern is `iHa = /@(?:"([^"]+)"|'([^']+)'|([^\s@]+))/g`, with the previous-character check `uHa` above.
  - `aIs` (`extractFileMentions`) runs on the prompt text in `AgentSession#So`, and nothing visible there turns it off.
  - U+2060 is neither whitespace nor in `uHa`, so a word joiner before `@` stops the match.
- **Every path the coordinator gets text through is covered.** All three (`sendUserMessage`, the `session_stop` `additionalContext`, and `coordinator.turn` in `inbox.ts`) build their text with `handOver`.
- **The orchestration package is at its 2430-line budget again.** The comment went into the file's header instead of above line 14, and line 14 is now very long. Taste, not a defect.
- F2–F4 in `findings.md` are open, outside Scope, and fit the findings format.

## Checks run

- **`npm ci`:** passed, 22 packages added.
- **`npm run check`:** tsc reported no errors.
- **`npm test`:** 1224 tests, 1163 pass, 0 fail, 61 skipped. This matches the worker's numbers, and the structure and line-budget tests pass.
- **Fuzz test:** a throwaway node script ran the escape and omp's exact pattern over 200,000 random strings, built from `@`, several kinds of whitespace and line break, the bracket and quote characters, and U+2060. omp matched none of the escaped outputs.
- **Mutations:** the ten in the table above, each run with `node --test --test-name-pattern='an @<path> in a message' packages/orchestration/test/inbox.test.ts`. Each was restored with `git checkout -- packages/orchestration/src/hand-over.ts`, and `git status` is clean.

FAIL