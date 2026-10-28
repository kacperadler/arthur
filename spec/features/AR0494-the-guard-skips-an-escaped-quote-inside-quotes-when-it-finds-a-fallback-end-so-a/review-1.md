# AR0494 - Review 1

- Job: 2026-10-28-review-71dd6d51
- Branch: arthur/2026-10-28-worker-444ea31a
- Commit reviewed: a0a43e71757f984a65b9fb10d8d5bf2ba21e2d14
- Verdict: FAIL

## Final message

**Findings**

1. **`packages/core/src/shell-words.ts:44`: the tests don't catch removing the `s` flag from the new regex, and removing it brings the hidden-command bypass back.** Without the flag, `\\.` no longer matches a backslash followed by a newline inside double quotes. `closing()` then treats the next `"` as opening a new quote, so the `${…}` runs to the end of the text.
   - What bash does: `x=; echo "${x:-"\⏎"}"; echo AFTER` prints an empty line, then `AFTER`, so the command after the `${…}` runs.
   - With the branch's code, `shellCommands` returns `echo`, then `rm X`, so the guard judges `rm X`.
   - With the mutation (`/s.exec` → `/.exec`), `shellCommands` returns only `echo "\\}; rm X"`, so `rm X` is hidden from the guard again.
   - With that mutation, `worktree-guard.test.ts` and `shell-words.test.ts` still give 12 pass, 0 fail.

   The ticket asks `closing()` to honour "a backslash inside double quotes as bash does". The only test row covers `\"`, so one part of the escape handling that matters for security has no test. The review criteria count an uncaught mutation of a key behavior as a FAIL. A second row such as `'echo "${x:-"\\\n"}"; rm ../../acme/README.md'` → `MAIN` would catch it.

2. **`packages/core/src/shell-words.ts:44`: the tests don't catch making the closing `"` required (`"(?:\\.|[^"\\])*"?` → `…*"`).** With that mutation, a double quote that is never closed inside a `${…}` or `$(…)` makes `exec` return `null`, and the `!` turns that into a TypeError. The tests still gave 12 pass, 0 fail. The worker's message says "a quote that is never closed still runs to the end of the text, as before", but no test covers that case. With the branch's real code it does work: `echo "${x:-"\` and `echo "${x:-"a\"` both parse without error.

**Notes (not blocking)**

- **Security, same line, existing before this branch and outside this ticket's Done means:** `closing()` doesn't honour `\'` inside ANSI-C `$'…'` quoting.
  - In bash, `echo $(echo $'\')'); echo AFTER` prints `')` and then `AFTER`.
  - `shellCommands('echo $(echo $'\'')'); rm X')` returns `echo "\\); rm X"`, so `rm X` is hidden from the guard.
  - The unquoted `${x:-$'\''}; rm X` form also parses without the `rm`. I didn't run that one through the guard; its unquoted-fallback check (line 89) may still refuse it.
  - This needs its own ticket.
- I checked that bash treats `'…'` as a quote when it finds the end of a double-quoted `${…}`: `echo "${x:-'}'}"` prints `'}'`. `closing()` agrees with that.
- The new `findings.md` (F1, the `limits.test.ts` timing) is outside the ticket's Scope list but follows the findings workflow. In my full run the suite passed, so F1 did not reproduce on a quieter machine.
- `shell-words.ts` is at 200 lines, the cap.

**Checks run**

- **`npm ci`:** exit 0.
- **`npm run check` (tsc):** exit 0.
- **`npm test`:** 1230 tests, 1169 pass, 0 fail, exit 0. I ran it once, with its output in a log file in the worktree, which I deleted afterwards. An earlier run that the harness moved to the background I killed and ignored.
- **Bash:** `x=; echo "${x:-"\""}"; echo AFTER` prints `"` and then `AFTER`, so the ticket's case reproduces.
- **`shellCommands` on the branch:** `echo "${x:-"\""}"; rm X` now gives a separate `rm X` command. The same holds for `echo ${x:-"\""}; rm X`, `echo $(echo "\")"); rm X` and `echo "${x:-"a\\"}"; rm X`.
- **Mutations**, each run against `worktree-guard.test.ts` and `shell-words.test.ts`:
  - Escape part removed (`"[^"]*"?`): 11 pass, 1 fail. The new row catches it.
  - `s` flag removed: 12 pass, 0 fail. Not caught (finding 1).
  - Closing `"` made required: 12 pass, 0 fail. Not caught (finding 2).
- Every mutation was restored with `git checkout --`, and `git status --short` is clean.

FAIL