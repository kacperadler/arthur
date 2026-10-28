# AR0532 - Review 2

- Job: 2026-10-28-review-284334b1
- Branch: arthur/2026-10-27-worker-96067971
- Commit reviewed: 58a82ea88166048eefd15c19d1b3a48915fa2a11
- Verdict: FAIL

## Final message

**FAIL: one weakness found by a mutation is still left in the test.** The escape now holds against omp's real check. But the test checks only 2 of the whitespace characters the escape covers, so narrowing the whitespace part of the pattern brings the file read back and the test still passes.

## Findings

1. **`packages/orchestration/src/hand-over.ts:14`: changing `\s` to `[ \t]` in the escape's lookbehind goes unnoticed.**
   - **The mutation:** the lookbehind becomes `(?<=^|[ \t([{<"'`])`.
   - **What it breaks:** the test still passes (`pass 1, fail 0`), yet omp's own check uses JS `\s`. Line breaks are split out of a line before the escape runs, but these characters can still sit inside one: U+00A0, U+1680, U+2000–U+200A, U+202F, U+205F, U+3000 and U+FEFF.
   - **Proof:** with my throwaway script (no file edits), `x` then U+00A0, U+3000, U+2003, U+FEFF or U+202F, then an at-sign and `/etc/passwd`:
     - the escape as written leaves omp's pattern no match;
     - the narrowed escape leaves `/etc/passwd` matched every time, so omp would read it.
   - **Why the test misses it:** the test text only has a space and a tab before an at-sign. A non-breaking space is common in text pasted from a phone, a web page or a review, and the mutation is a plausible "simplification".
   - **Why it fails the branch:** the review criteria count an uncaught mutation of a key behavior as a FAIL. This is the same kind of gap review-1 reported for the bracket and quote characters, now for the whitespace class.
   - **Fix:** add at least one at-sign after U+00A0, and one after a non-Latin space such as U+3000, to the test text and the expected `quoted` string.

## Notes (not blocking)

- **The worker's reading of omp 18.3.0 is right.** I read the bundled source in `~/.local/bin/omp` myself:
  - The match pattern is `iHa = /@(?:"([^"]+)"|'([^']+)'|([^\s@]+))/g`.
  - `dHa` keeps a match at index 0 or when the character before it passes `uHa = /[\s([{<"'`]/`. It has no `g` flag, so it keeps no state between calls.
  - `aIs`, which is `extractFileMentions`, runs on the prompt text in `AgentSession` and feeds `lIs`, which reads the files.
  - U+2060 matches neither `\s` nor `uHa`, so a word joiner before the at-sign stops the match.
- **Every way text reaches the coordinator goes through `handOver`:**
  - `inbox-extension.ts:95` (`sendUserMessage`);
  - `inbox-extension.ts:188` (the `session_stop` `additionalContext`);
  - `inbox.ts:150,155,162` (`coordinator.turn`).
- **The ticket's Done means are met apart from finding 1:**
  - The test drives the extension with a fake `pi`, checks the exact content handed over, and fails when the escape is removed.
  - The cases include the start of the text, after a space, after `> `, and inside a quoted line.
  - Findings F1 states omp's behavior with its source.
  - `docs/commands/coordinator.md` explains the escape.
- **Last commit `58a82ea8`:** it touches only the test and `findings.md`, as the worker says.
- **F2–F4:** they stay `open`, are outside this ticket's Scope, and follow the findings format. F2's account of the file attached to the worker's session is data from the worker; I could not reproduce it.

## Checks run

- **`npm ci`:** passed, 22 packages added.
- **`npm run check`:** tsc reported no errors.
- **`npm test`:** 1224 tests, 1163 pass, 0 fail, 0 cancelled, 61 skipped. This matches the worker's numbers.
- **Mutations of `hand-over.ts`:** each was run with `node --test --test-name-pattern='an @<path> in a message' packages/orchestration/test/inbox.test.ts`, then restored with `git checkout --`. `git status` is clean afterwards.

  | Mutation | Test result |
  |---|---|
  | `^` removed | fails (caught) |
  | `\s` removed | fails (caught) |
  | `(` removed | fails (caught) |
  | `[` removed | fails (caught) |
  | `{` removed | fails (caught) |
  | `<` removed | fails (caught) |
  | `"` removed | fails (caught) |
  | `'` removed | fails (caught) |
  | backtick removed | fails (caught) |
  | word joiner replaced with nothing | fails (caught) |
  | `\s` changed to `[ \t]` | **passes (not caught)** |

FAIL