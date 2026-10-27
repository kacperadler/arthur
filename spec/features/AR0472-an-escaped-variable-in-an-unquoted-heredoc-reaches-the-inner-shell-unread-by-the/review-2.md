# AR0472 - Review 2

- Job: 2026-10-27-review-f5f5d9f5
- Branch: arthur/2026-10-27-worker-75604f27
- Commit reviewed: 9644def0f3074917e8d15d81dbdfc228ad98a2fc
- Verdict: PASS

## Final message

No blocking findings. I applied the mutation the user asked for, the tests caught it, and I restored the source.

**Findings:** none.

**Notes (non-blocking):**
- In this round the range only adds the two rows `bash <<EOF\nrm \$x${main}/README.md\nEOF` and `cd ${main}; bash <<EOF\ncd /tmp; rm \$OLDPWD/README.md\nEOF` to `packages/core/test/worktree-guard.test.ts`. Both expect `MAIN`. `shell-words.ts` is unchanged since 294c297a.
- The mutated run failed only on the `$x` row. I didn't check the worker's claim that the `OLDPWD` row also catches the mutation alone, because the narrowed scope only asked to confirm that a row fails.
- I started a full `npm test` before the narrowed instruction arrived. I stopped it with SIGTERM, so its exit code 1 means nothing; it gave no test result.

**Checks run:**
- `npm ci` added 22 packages.
- `npm run check` (`tsc`) printed no errors.
- Unmutated, `node --import @arthur/core/testing --test packages/core/test/worktree-guard.test.ts` gave 11 tests, 11 pass, 0 fail.
- **Mutation:** I dropped `$` from the escape set in `outer()` at `packages/core/src/shell-words.ts:122`, changing `/\\([$`\\\n])|` to `/\\([`\\\n])|`. The same test file then gave 11 tests, 10 pass, 1 fail. The failure was `bash {"command":"bash <<EOF\nrm \\$x../../acme/README.md\nEOF"}: undefined`, where `'the main checkout'` was expected.
- **Restore:** `git checkout -- packages/core/src/shell-words.ts`; `git status --short` then showed a clean tree.

PASS