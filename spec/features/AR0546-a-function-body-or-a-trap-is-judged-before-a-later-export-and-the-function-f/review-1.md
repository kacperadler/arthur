# AR0546 - Review 1

- Job: 2026-10-29-review-ff35cd03
- Branch: arthur/2026-10-29-worker-29e2a868
- Commit reviewed: 2f68d5209c68d88b4af7aca309468b6881fbfe58
- Verdict: FAIL

## Final message

The branch blocks the four commands the ticket lists, and `npm ci`, `npm run check` and `npm test` all pass, but it fails review. The same attack still gets through when the git config is set in front of the function call instead of by `export`.

## Findings

1. **`packages/core/src/worktree-guard.ts:84`: the guard ignores config set in front of a call to a function, so the ticket's own attack still passes.** The line counts config in the call only when it is a bare assignment or set by `export`, `declare`, `typeset`, `readonly` or `local`. It skips assignments written before a command other than `git`. Bash puts those assignments in the environment of a function for as long as it runs, and the git calls inside the function see them. These commands pass `worktreeRefusal` on this branch (I judged the strings through the function and never ran them in a shell):
   - `f() { git c a.c d; }; GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.c GIT_CONFIG_VALUE_0=config f`. This is the ticket's first command with the config moved in front of `f`; it runs the same `alias.c=config`.
   - `f() { git status; }; GIT_CONFIG_GLOBAL=/tmp/x.cfg f`
   - `f() { git status; }; XDG_CONFIG_HOME=/tmp/h f`
   - `cd() { git status; }; XDG_CONFIG_HOME=/tmp/h cd .`

   Done means says a function body is judged "with every config assignment of the whole call counted", and AR-D322 says a git call in a bash call that sets git config anywhere is refused. These calls set config and their git calls pass. The out-of-scope list (AR0545) names only `read`, `for`, `let` and namerefs, not this form. No test row covers it.

## Notes (not blocking)

- **The ticket's two `HOME` rows prove nothing new.** They were already refused before this branch (AR0496), so they cannot fail when the fix is removed. The worker says so, and the `XDG_CONFIG_HOME` rows are the ones that test the fix.
- **F1 reaches further than written.** A `DEBUG` trap runs before every command, so `trap "cd <main>" DEBUG; rm -f README.md` passes. The trap's `cd` would run before the `rm`, but the guard judges the trap in a subshell, so it never sees the move. This passed before the branch too; it should go into F1's entry.
- **No bypass found in these:** `function f ( … )`, `function f() ( … )`, `function f` with `{` on the next line, `builtin trap` and `command trap`, `trap $'…'`, a trap with several signals, `trap … RETURN` inside a function, and config set by a `DEBUG` trap, a subshell, `bash -c`, `eval`, `local`, `declare -x`, or later in a loop. All are refused as they should be.
- You decided the budget raise to 6467 and the stricter refusal of a git call before a later config assignment, so neither counts against the branch.

## Checks

- `npm run check`: `tsc` reported no errors.
- `npm test`: 1288 tests, 1226 pass, 0 fail, 62 skipped. This matches the worker's numbers.
- AR0546 test (`node --test --test-name-pattern=AR0546 packages/core/test/worktree-guard.test.ts`) passes as committed. I broke the code seven ways, and the test failed each time:
  - second pass removed;
  - `trap` branch disabled;
  - `--` handling removed;
  - subshell around the trap removed;
  - `function` skip removed;
  - `function` skip moved from 2 words to 1;
  - second pass started with an empty config list instead of what the first pass found.
- A throwaway test file called `worktreeRefusal` on 34 command strings. It produced finding 1 and the notes above.
- Everything was restored afterwards: the throwaway test file and its temp files are deleted, and `git status --short` was clean after the mutations.

FAIL