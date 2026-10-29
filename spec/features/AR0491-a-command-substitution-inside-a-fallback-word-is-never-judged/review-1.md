# AR0491 - Review 1

- Job: 2026-10-29-review-25637713
- Branch: arthur/2026-10-29-worker-088efe1b
- Commit reviewed: 246a3a8ada8db85a9b7479a768c8d45be6751923
- Verdict: PASS

## Final message

No findings block the merge. The fix is in `packages/core/src/shell-words.ts:90-92`. It parses the fallback once, then pushes the parsed items into `before` from each `(` through its matching `)`. The fallback's own top-level words stay a word, as the ticket suggests. The new rows in `packages/core/test/worktree-guard.test.ts:300-306` cover every operator, quoted and unquoted, a backtick, nested fallbacks, and a `cd` that does not last.

The worker's correction to the Goal is right. With the new `before.push` line removed, the unquoted rows come back "cannot tell where this path leads" (the guard's unknown-path refusal) instead of the main checkout. The double-quoted `$(…)` and backtick rows come back `undefined`, so they were the real gap. The Goal row still fails before the change, because it expects the main checkout and got the unknown-path refusal. That meets "Done means".

## Notes (not blocking)
- **Bypass outside this ticket: the pattern operators.** `echo ${x#$(rm ../../acme/README.md)}` and `echo ${x/a/$(rm ../../acme/README.md)}` both pass with `undefined`, and bash runs that substitution. The fallback regex only matches `:?[-=+?]`, so `#`, `%`, `/`, `^`, `,` and substring words are never parsed. This was already the case before this branch and is not among AR0491 to AR0494. It should be a ticket of its own.
- An unquoted `${x:-\$(rm …)}` is now refused as the main checkout instead of "cannot tell". The escaped `$` leaves `(…)`, which the parser reads as a subshell. It is refused either way, so the change is only overcautious. The double-quoted form correctly passes.
- As the worker says, a substitution in a fallback is judged even when the variable is set, for example `${HOME:-$(…)}`. This only refuses more.
- `shell-words.ts` is exactly 200 lines. It got there by putting the one-statement `for` loop in `bodies` on one line, and its behavior is unchanged.
- Leaving `CHANGELOG.md` alone is consistent with history: its last entries all come from `spec: … settled` commits.

## Checks run
- **`npm run check`:** `tsc` clean.
- **`npm test`, run twice:** 1276 tests, 1208 pass, 6 fail, 62 skipped. All 6 failures are in `packages/manage/test/manage.test.ts` and print "the temporary folder /tmp has 8% of its space free". `df` shows `/` at 91%. The branch does not touch `packages/manage`, so these are the host, not the branch. 1208 + 6 = 1214, which matches the worker's 1214 passing.
- **`node --test packages/core/test/worktree-guard.test.ts`:** 12/12 pass.
- **Mutations:** for these runs I changed the row assertion at line 529 into a log line that prints each mismatched row. Each mutation was reverted with `git checkout --`.
  - Removing the new `before.push` line: all 11 new refusal rows mismatch.
  - Dropping `|| item === ")"`: the `cd` row mismatches.
  - `> 0` changed to `>= 0`: `rm ${x:-> …}`, `rm ${x:-a 2> …}` and `bash <<< ${x:-rm …}` mismatch.
  - `> 0` changed to `=== 1`: the nested row mismatches.
  - Dropping the wrap in double quotes: 13 of the existing double-quoted fallback rows mismatch.
  - The tests caught every mutation.
- **Throwaway bypass rows**, run through the test harness and never in a shell:
  - Refused as the main checkout: `"${x:-'$(rm …)'}"`, `${x:-"$(rm …)"}`, an unquoted backtick, `y=${x:-$(rm …)}`, a fallback substitution inside an unquoted heredoc body, and `"${x:-$(echo "}"; rm …)}"`.
  - Refused as "cannot tell": `${x:-$(echo }; rm …)}`.
  - Pass, as they should (bash does not run them): `${x:-'$(rm …)'}` and `"${x:-\$(rm …)}"`.
  - Pass with `undefined`: the pattern operators, as in the first note.
- After the checks, `git status` is clean: everything is restored and the temp file removed.

PASS