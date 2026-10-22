# AR0288 - Review 1

- Job: 2026-10-22-review-ar0288-7c266e0a
- Branch: h/2026-10-22-ar0288-677493d2
- Commit reviewed: 471c923a3dbe832e6e8f7b92c9fca46a6e6acd54
- Verdict: PASS

## Final message

## Review: AR0288 — eval stub help handling

### Findings
None that block merge.

### Notes
- Worker's "Needs action" item 2 (AR0291 becoming wider, since the `(?!.*--help)` scenario guards are now obsolete) is correctly scoped out — no such ticket exists on `main` yet, and leaving scenario files untouched matches the Done means of AR0288, which only covers `eval-stub.ts`.
- Docs (`eval.md`) and the `structure.test.ts` budget comment were updated consistently with the code change.

### Checks run (in the worktree, this branch)
- `npm ci`: clean.
- `npm run check` (`tsc`): clean, no errors.
- `npm test`: **1015/1015 pass**, matches worker's claim.
- `node --experimental-strip-types --test packages/develop/test/eval.test.ts`: 8/8 pass, including the rewritten help test.
- Ran the real `cli.ts` by path (`node --experimental-strip-types packages/core/src/cli.ts ...`) for `nosuch --help`, `--help`, `help`, `help a b` in an empty folder; output text and exit codes match the stub's output byte-for-byte (modulo the "config did not load" note the worker correctly notes an eval run never hits, since its config loads).
- `wc -l packages/develop/src/*.ts` → 633 total, matches the `BUDGETS.develop: 633` raise in `test/structure.test.ts`, and the ticket's Decisions line ("2026-10-22: Coordinator (free hand): line budget raise accepted, develop 628 to 633...") already present on `main` — requirement satisfied before this branch.
- Mutation tests (own, inside this review worktree, each restored with `cp`/verified via `git diff --stat` clean afterward):
  - `Object.hasOwn(pages, word)` → `true`: test fails (caught) — confirms the unregistered-command / `constructor`-as-own-property boundary is exercised, not just plausible.
  - `process.exitCode = help[1];` removed: test fails (caught) — confirms exit-code assertions are real, not vacuous.
  - `--project` filter predicate → `true` (filter becomes no-op, so `--project` and its value leak into word stream): test fails (caught) — confirms the `--project <name>`-ignored behavior is actually tested, not just asserted in prose.
  - All three mutations match families the worker's final message already claims as caught (17 total); spot-check corroborates the claim rather than contradicting it.
- `git status --porcelain` after restoring mutated file: clean, worktree matches the commit under review.

The fix closes exactly the gap the ticket describes (help calls, registered or not, well-formed or not, never fall into a scenario's scripted answer), text/exit codes verified against the live CLI, tests cover every branch (registered page, unregistered command, `help` of two words, `help`/`--help`/bare `arthur`), and the `calls`/`never` exclusion is confirmed generic (unchanged `eval-run.ts` filter on `entry.help !== true` already covers the new branches). Scope is tight: only the four files the fix needs.

PASS
