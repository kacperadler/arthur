# AR0029 - Review 1

- Job: 2026-10-16-review-ar0029-readme-wha-b5836aef
- Branch: h/2026-10-16-ar0029-readme-what-exist-016a5102
- Commit reviewed: 6ab9d57ba57376a5d073a6a6beacb72389cc2d99
- Verdict: PASS

## Final message

Worktree clean, no leftover mutation.

**Findings:** none that block merge.

**Notes:**
- `test/readme.test.ts` partially overlaps `packages/core/test/config-check.test.ts`'s existing CLI-spawn test (zero-plugin case wasn't covered via the spawned binary before, only via direct `configCheck()` call), but it isn't a pure source-text pin: it regex-extracts the command/link from the README and exercises the real CLI binary and a real file-existence check, not the wording itself. This satisfies the ticket's "with a test that proves it" without becoming ceremony.
- Worker's final message accurately lists the single commit, file set, and line counts.

**Checks run (in this worktree, range `4f40dd3ab27..6ab9d57ba57`):**
- `npm ci`: installs clean (5 packages).
- `npm run check` (`tsc`): no errors.
- `npm test`: 45/45 pass, including `the README status line names a command that runs and links an existing roadmap`.
- Mutation: changed README's backticked command to `arthur config nothing`, reran `node --test test/readme.test.ts` — failed with `arthur config nothing exits 0 on a config with no plugins`, actual `[2, 'usage: arthur config check\n']` vs expected `[0, '']`. Matches worker's claimed mutation result. Restored via `git checkout -- README.md`; `git status --porcelain` empty afterward.
- README wording verified against real `configCheck` output format (`set`/`missing` lines, no values) and against the existing secret-redaction test — accurate.
- Diff confined to `README.md` line 5 and the new `test/readme.test.ts`; matches ticket scope (AR0029) and Done-means (fix + test, `npm test`/`npm run check` pass).

PASS
