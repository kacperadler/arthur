# AR0545 - Review 2

- Job: 2026-10-29-review-e56870bb
- Branch: arthur/2026-10-29-worker-062fd159
- Commit reviewed: 35ba684b70dc54f1e5d3755ad2a1ec8030429d66
- Verdict: FAIL

## Final message

Verdict: FAIL. Bash removes double quotes inside arithmetic, so a quoted config name still gets past the new arithmetic check. All the mutations I tried were caught and all checks pass, but this hole fails the branch.

## Findings

1. **`packages/core/src/worktree-guard.ts:55`: a config name split by double quotes inside `((…))`, `$((…))` or `$[…]` is not counted. This is a security bypass.**
   - **How it gets through:** the new check looks for names in the raw text of each arithmetic span (`span.match(/[A-Za-z_]\w*/g)`). Bash takes the double quotes out of an arithmetic expression before it evaluates it. So `HO""ME` becomes `HOME`, while the guard only sees the pieces `HO` and `ME`, which are not config names.
   - **Real bash, with a harmless name:** `env -u FOO bash -c '(( FO""O = 5 )); echo "[$FOO]"'` printed `[5]`. The same with `: $(( FO""O = 6 ))` printed `[6]`, `echo $[ FO""O = 7 ]` printed `[7]`, and `eval "(( FO\"\"O = 5 ))"` printed `[5]`.
   - **What `worktreeRefusal` lets through** (throwaway test on this commit):
     - `(( HO""ME = 5 )); git status`
     - `: $(( XDG_CONFIG""_HOME = 1 )); export XDG_CONFIG_HOME; git status`
     - `echo $[ HO""ME = 1 ]; git status`
     - `eval '(( HO""ME = 5 ))'; git status`
   - **What it refuses:** `let HO""ME=5; git status` and `let "HO""ME=5"; git status`. So the arithmetic check is weaker than the branch's own `let` check, though `((…))` is just another way of writing `let`.
   - **Why it fails:** the final message says each `((…))`, `$((…))` and `$[…]` "counts as setting config when it names a git-config variable", and it doesn't for these. The same set of names reaches git through the same opening review 1 failed on.
   - **Likely fix:** drop the `"` characters from `span` before matching names, and add a refused row for each of the three forms.

## Notes
- **Other arithmetic forms that set a variable, outside the Done means list (belong under F1):**
  - Substring offsets: `x=abc; : ${x:HOME=1}; git status` passes, and real bash sets the variable (`${x:FOO=1}` set `FOO=1`).
  - `wait -p HOME; git status` and `coproc HOME { cat; }; git status` also pass.
- **Over-refusal:** `read -p HOME x <<< a` is refused, because the prompt operand is counted as a name. This is a ux issue, not a hole.
- **Accepted cost:** `git status; (( $n + 1 ))` is refused. This is F2's cost, accepted under AR-D318.
- **Things I tried that are not holes:**
  - An early-closing bracket, `$(( a ] ] + HOME = 5 ))`, passes the guard. But bash stops with a syntax error before it reaches the assignment (checked with `FOO`).
  - `(( "HOME" = 5 ))` and `(( HOME"" = 5 ))` are refused.
  - These are all refused: `declare -gn`, `declare -n --`, `command read`, `IFS=: read`, a quoted `read` or `printf -v` name, `local -n` in a function, `mapfile -O`, `${HOME[0]:=x}`, `for ((HOME=5;0;))` and `((HOME=5))`.
- **Style:** the worker got back under the line budget by packing more code onto long lines (the `parse` line, `moves`/`args`/`sets`/`names`). The file was already written in this dense style (longest line 1495 characters both before and after), so this follows the repo's way. It does make the guard hard to review.

## Checks
- `npm ci`: added 24 packages, exit 0.
- `npm run check` and `npm test`, both in one bash call with the 1800 s timeout: tsc clean; 1288 tests, 1226 passed, 0 failed, 62 skipped. This matches the worker's claim. No `limits.test.ts` timing failure.
- `wc -l packages/core/src/worktree-guard.ts`: 183, as claimed.
- **Mutations**, each run against the test named "without an assignment word" (TAP reporter). The unmutated baseline had 0 failures, and every one of these 17 mutations failed the test:
  - the `$`/backtick span check removed
  - the span running to the end of the text
  - `[`/`]` not counted in depth
  - `$[` scanning from `$`
  - the config-name check on the span removed
  - `$[` not matched
  - the `indirect` check removed
  - `:?=` narrowed to `:=`
  - the nameref `$` text check off
  - the `let` word check off
  - the run-time-name operand check off
  - the `for` nameref rebinding check off
  - the `-vNAME` cluster check removed
  - `select` dropped
  - `getopts` dropped
  - option-cluster scanning off
  - the plain-nameref-target check removed

  `git status --short` was clean after the source was restored.
- **Throwaway probe:** I appended a temporary test with 30 `worktreeRefusal` probes to the test file. The results are the ones above. I then restored it with `git checkout -- packages/core/test/worktree-guard.test.ts`.

FAIL