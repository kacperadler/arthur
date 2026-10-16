# AR0067 - Review 1

- Job: 2026-10-16-review-ar0067-one-contin-0c5ff950
- Branch: h/2026-10-16-ar0067-one-continue-at-a-52c02319
- Commit reviewed: 0ed800c6144bf9ece55de464a1a784ca8fc717de
- Verdict: PASS

## Final message

Tree clean, 262/262 pass, worktree unmodified.

**Findings:** none blocking.

**Notes:**
- F1 (killed `arthur continue` leaves `continuing` behind, blocking future continues until manual removal) is an honest, documented limitation, not required by the ticket's Done means; acceptable as an open finding recorded in `findings.md` and `continue.md`.
- AR0018 (in review, parallel) also touches `job-control.ts`; worker avoided its lines (`ID` export) and `job-record.ts`, which AR0018 doesn't touch — plausible low-conflict overlap, not verifiable without that branch, out of scope here.

**Checks run (in this worktree, against `efb4141b..0ed800c6`):**
- `npm ci`: installs clean.
- `npm run check`: passes, no errors.
- `npm test`: 262 tests, 262 pass, 0 fail — matches worker's claim.
- Race test for `mkdirSync(path, {recursive:true})` exclusivity: 10 concurrent two-process trials, each round exactly one `undefined`/one path returned — confirms the Done-means claim that this is a correct exclusive create, no double-success observed.
- Mutation 1 — removed the `mkdirSync` lock-acquisition `throw`: both race tests (`in its scope`, `bare`) fail, as claimed.
- Mutation 2 — emptied the `finally` cleanup block: 6 tests fail (same set of 6 names the worker listed: wrapper-does-not-start, both race variants, refusal test, beforeSpawn test, binary end-to-end test).
- Mutation 3 — removed the wrapper's `rmSync("continuing")` after writing `running`: both race variants time out (~20s) waiting for the lock to be freed, matching the worker's claim; verified via backgrounded job since it ran past the foreground timeout.
- All mutations reverted; `git status --porcelain` clean before verdict.
- `job-record.ts` reflow: same key set, same computed values, `Object.entries` + one `writeFileSync` per key — file-per-key output is unaffected by literal line-wrapping/reordering; confirmed by reading the full file.
- Core line budget: `BUDGETS = { core: 4234 }` in `test/structure.test.ts` unchanged (not touched by this diff); `find packages/core/src -name "*.ts" | xargs cat | wc -l` gives 4233 — under budget, no raise, as claimed.
- Doc update in `continue.md` added in the right place (refusal list) and matches the actual thrown message and F1's consequence.

PASS
