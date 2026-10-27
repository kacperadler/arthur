# AR0475 - Line budgets on one line, plus a comment log, conflict on most merges of main

```json
{
  "id": "AR0475",
  "title": "Line budgets on one line, plus a comment log, conflict on most merges of main",
  "date": "2026-10-27",
  "budget": 2
}
```

## Description

Each package's line budget sits on its own line in the structure test, without the comment log above it, so two tickets that raise different packages no longer conflict there.

## Goal

almost every ticket that runs alongside another hand-merges the same line and adds a "Merged main" note. That is the most frequent conflict on the board, and it costs every worker time.

Evidence:
- `test/structure.test.ts:770`: all 19 budgets sit on one line, `const BUDGETS = { core: 6345, … }`. Above it are about 765 comment lines that log each raise and each merge, for example `:764-769` `// Merged main (AR0463, AR0374) into AR0454: main's budgets plus AR0454's raises (recounted with wc -l)`.
- I checked every `Merge branch 'main' into …` commit: 59 of 90 had to resolve `test/structure.test.ts` by hand (`git show --cc <merge> -- test/structure.test.ts` not empty). Of the 11 merges in the last 24 hours, 10 did (bdcdd3e5, 375b9c5e, 684330d8, f0816ca7, e0b096d2, 36428002, 8fba5b40, bb7c154b, 8e3a1668, f1d84686). bdcdd3e5 shows both sides adding comment blocks and rewriting the same `BUDGETS` line.
- The styleguide (Shape) says the number lives in that test and "a raise is a decision recorded in the ticket". The tickets do record it, for example AR0436 `ticket.md:47` (AR-D123), so the comments repeat it.
- `packages/develop/src/plugin-new.ts:16,40-41,98` reads and rewrites the one-line `BUDGETS` form.

- Kind: chore

## Done means

- `BUDGETS` has one package per line and no raise log; `arthur plugin new` still adds a package's budget, its test passes; `npm test` passes with the same numbers.

## Scope

In:
- Put each package's budget on its own line in `BUDGETS`, so raises to different packages don't conflict.
- Replace the comment log with the existing one-line rule. The reasons stay in each ticket's Decisions and in Git history.
- Update `plugin-new.ts` (regex and insert) and its test to the new form.
- The budget numbers and the rule itself stay unchanged.

Out:
- Anything beyond the proposal.

## Decisions

- 2026-10-27: Source: audit spec/quality/2026-10-27.md
