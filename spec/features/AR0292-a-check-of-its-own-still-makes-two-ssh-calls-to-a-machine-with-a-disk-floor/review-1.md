# AR0292 - Review 1

- Job: 2026-10-22-review-ar0292-d3682197
- Branch: h/2026-10-22-ar0292-fdcf5f74
- Commit reviewed: 62541a008f8dc1c12cb9fd3c42dbb453db0e45d9
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

**Findings:** none that block merge.

**Notes:**
- Worker's final message flagged an open need ("confirm a line-budget raise") that main already resolved in a later commit (`7fd2ff9 docs(AR0292): resources budget raise accepted`, outside the judged range) — the ticket's Decisions section now explicitly accepts `resources 607 to 616`, satisfying the styleguide's "a raise is a decision recorded in the ticket" rule as of `main`.
- `measure`/`ask` split is a clean, minimal refactor: `ask` does the one combined `sh -c` (`node -e` then df, free line first) exactly as the ticket's Done-means describes, reusing `readDisk`/`measure`'s existing JSON parser; `local` is untouched (still `os`-based, no ssh), matching ticket's Out-of-scope for the round path.
- Timeout (`code === null`) and non-{0,127,255} exit-code branches in `ask` are untested — worker states this plainly; the lines are moved unchanged from the previously-tested `measure`, a reasonable limit to state rather than a gap to fail on.

**Checks run (in this worktree, range `1a0beed..6254100`):**
- `npm ci`: clean.
- `npm run check`: `tsc` clean, no errors.
- `npm test` (full suite, backgrounded ~337s): 1030/1030 pass, 0 fail — matches worker's claim, "the repository keeps every rule" (structure/budget test) passes with `resources: 616`.
- `node --import @arthur/core/testing --test packages/resources/test/disk.test.ts`: 11/11 pass, including the new "a check of its own on another machine with a floor makes one ssh call…" test, 1 ssh call per check, 5 in all — matches worker's claim.
- Mutation 1 (drop the df half of `BOTH`, forcing fallback to a second ssh call): new test fails, `actual: [2, …] expected: [1, …]` — matches worker's claim exactly. Restored via `cp` from saved original, verified `diff` clean.
- Mutation 2 (run `ask` over ssh for `name === "local"` too, removing the local-stays-on-`os` guard): `room.test.ts` fails on two different assertions (idle-load test, context/`/resources` line test) — matches worker's claim of 6 room/feature-caps failures breaking. Restored, `git status --short` clean.
- `wc -l packages/resources/src/*.ts`: 616 total, exactly the raised budget.
- Docs (`packages/resources/docs/resources.md`, "Free disk" section) now states a check of its own costs one ssh call too, matching the code.

PASS
