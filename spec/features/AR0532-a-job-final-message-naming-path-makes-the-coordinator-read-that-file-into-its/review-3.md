# AR0532 - Review 3

- Job: 2026-10-28-review-30bdce48
- Branch: arthur/2026-10-27-worker-96067971
- Commit reviewed: 1c1cdc4c9628c7fb9f0ba9e9291df5f0cae228c3
- Verdict: PASS

## Final message

No blocking findings. Review 2's finding is fixed: narrowing the escape's `\s` to space and tab now fails the test.

## Findings

None.

## Notes (not blocking)

- **One narrowing still passes the test.** I replaced `\s` in the lookbehind at `packages/orchestration/src/hand-over.ts:14` with a list of exactly the characters the test uses: space, tab, U+00A0, U+3000 and U+FEFF. The test still passes, while omp would still match an `@` after U+1680, U+2000 to U+200A, U+202F or U+205F. To get there, someone has to copy the test's characters into the code, which is not a plausible "simplification". The normal narrowings are all caught (table below). This round's Decision (AR-D219) asked for tests with the less common spaces, and the branch has them.
- **The last commit stays in scope.** `1c1cdc4c` touches only `packages/orchestration/test/inbox.test.ts` (5 lines added, 4 removed), as the worker says. `hand-over.ts` is unchanged since review 2.
- **The Done means points hold across the whole range:**
  - The test drives the inbox extension with a fake `pi` and checks the exact text handed over: while idle, joining a turn (`deliverAs: "aside"`) and resuming one (`session_stop`).
  - It covers an `@` at the start, after a space, inside a quoted line and after `> `.
  - F1 in `findings.md` states how omp 18.3.0 reads these files and cites its source.
  - `docs/commands/coordinator.md` says how the escape works.
- F2 to F4 stay `open`. They are outside the ticket's Scope and follow the findings format.

## Checks run

- **`npm ci`:** passed, 22 packages added.
- **`npm run check`:** tsc reported no errors.
- **`npm test`:** 1224 tests, 1163 pass, 0 fail, 0 cancelled, 61 skipped. This matches the worker's numbers.
- **Mutations:** done in a throwaway copy of the checkout in `/tmp`, which I then deleted; my working directory is untouched. Each was run with `node --test --test-name-pattern='an @<path> in a message' packages/orchestration/test/inbox.test.ts`.

  | Change to the escape in `hand-over.ts` | Test result |
  |---|---|
  | none | passes |
  | `\s` changed to space and tab | fails (caught) |
  | `\s` changed to space, tab, U+00A0 | fails (caught) |
  | `\s` changed to space, tab, U+00A0, U+3000 | fails (caught) |
  | `\s` changed to space, tab, U+00A0, U+3000, U+FEFF | **passes** (see the first note) |
  | `\s` removed | fails (caught) |
  | `^` removed | fails (caught) |
  | `(` removed | fails (caught) |
  | `[` removed | fails (caught) |
  | `{` removed | fails (caught) |
  | `<` removed | fails (caught) |
  | `"` removed | fails (caught) |
  | `'` removed | fails (caught) |
  | backtick removed | fails (caught) |
  | no word joiner added | fails (caught) |
  | `g` flag dropped | fails (caught) |

- **Fuzz test:** a node one-liner ran 300,000 random strings through the line split and escape, then omp's pattern and its check of the character before `@`. The strings were built from `@`, brackets, quotes, `>`, U+2060 and all 25 characters JavaScript's `\s` matches. omp matched nothing in any escaped output.

PASS