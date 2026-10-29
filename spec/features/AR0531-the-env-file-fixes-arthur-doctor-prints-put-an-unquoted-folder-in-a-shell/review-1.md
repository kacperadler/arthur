# AR0531 - Review 1

- Job: 2026-10-28-review-1061df4f
- Branch: arthur/2026-10-28-worker-e7d4c366
- Commit reviewed: 7824b90982a8f4893dd3a2875983f7d0190f1e75
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0531 asks: both env file fixes that `arthur doctor` prints quote the folder and the name as one shell word each. The new test runs each printed fix in a folder named `my 'secret' files` and gets `ok` after it, as the ticket's Done means requires. Both changes outside the ticket's stated scope have a reason in the worker's final message:
- the doctor doc page changed with the printed fixes it describes, which the review criteria require;
- the `.gitignore` advice became a runnable command, because the ticket's Goal says every env file fix runs as printed.

## Notes (not blocking)
- **Doc claim is a little too strong.** `packages/core/docs/commands/doctor.md:32` says the escaped `.gitignore` line "names the file and nothing else". `*` and `?` are not escaped, so a name like `e?v` writes a pattern that also ignores `eXv`. The file itself is still ignored, so the fix still works; only the "nothing else" wording overstates it.
- **Line budget met by packing code.** `packages/core/src/requirements.ts:101,111`: commit `7824b909` stays within the core's line budget (6414) by moving the `word` helper and its comment into the existing one-line `fix` getter and comment. That getter line is now about 450 characters. It is within the budget and follows the file's existing one-line getter, but a recorded budget raise would have been the cleaner route.
- **No exact-pattern match in `git rm`.** The tracked fix's `git rm --cached -- '<name>'` treats the name as a pathspec. I checked it with real Git: when `e[nv]` and `en` were both tracked, and `e*v` and `eXv` both tracked, Git removed only the literal file each time. So no other file gets untracked.
- **Leading newline is covered only by the exact-text check.** Removing the `\n` in `printf '\n%s\n'` is caught only by the test that pins the printed line word for word. No test runs the fix on a `.gitignore` that lacks a final newline. I checked by hand that the appended line still works on such a file.

## Checks run
- `npm ci`, then `npm run check && npm test` in my worktree: tsc passed. Tests: 1231, pass 1170, fail 0, skipped 61, exit 0. This matches the worker's numbers. A first attempt was moved to the background where I could not read it, so I stopped my own process group and reran it with output to a log file in the worktree, which I deleted afterwards.
- **Mutations**, each run with `node --import @arthur/core/testing --test packages/core/test/doctor.test.ts` and restored with `git checkout -- packages/core/src/requirements.ts` (the worktree is clean):

| Mutation | Result |
|---|---|
| Drop the leading `\n` from `printf` | 1 fail (exact-text check) |
| Leave the `.gitignore` path unquoted | 2 fail |
| Drop the trailing-space escape `\| $` | 1 fail (`env `: the .gitignore fix) |
| `word` without the `'\''` escape | 1 fail |

- **By hand with real Git:**
  - `git rm --cached -- 'e[nv]'` and `-- 'e*v'` removed only the literal file.
  - A name with two trailing spaces, written as `env \ ` into a `.gitignore` that had no final newline, is ignored (`git check-ignore -q` succeeded).

PASS