# AR0545 - Review 1

- Job: 2026-10-29-review-e254ee6a
- Branch: arthur/2026-10-29-worker-062fd159
- Commit reviewed: bd3b100f1e93c831d6b1b65c4fb98ce67cba3167
- Verdict: FAIL

## Final message

## Findings

1. **`packages/core/src/worktree-guard.ts:101`: a run-time name before `|=`, `&=` or `>>=` inside `((…))` / `$((…))` is not counted.** This is a security bypass, and it contradicts the final message. The worker claims "A run-time name there counts only before an assignment operator", and the refused rows pin `v=HOME; (( $v = 5 ))`. The check looks for the operator in the word itself or the next word (`[index, index + 1]` with `/(?<![=!<>])=(?!=)|\+\+|--/`). But shell-words splits `|`, `&` and `>>` off as shell operators, so `=1` ends up in another command or a redirect, and the check never sees it. I ran each case through `worktreeRefusal` in a throwaway script:
   - `v=XDG_CONFIG_HOME; (( $v |= 1 )); export XDG_CONFIG_HOME; git status` passes
   - the same with `(( $v &= 1 ))` passes
   - the same with `(( $v>>=1 ))` passes
   - `v=XDG_CONFIG_HOME; : $(( $v |= 1 )); export XDG_CONFIG_HOME; git status` passes, while `: $(( $v = 1 ))` is refused
   - `*=`, `-=`, `^=`, `++`, `--` are refused, and `<<=` is refused by the older `<<`-after-`((` rule

   In real bash (checked with a harmless `env | grep`, no git), `unset XDG_CONFIG_HOME; v=XDG_CONFIG_HOME; (( $v |= 1 )); export XDG_CONFIG_HOME` exports `XDG_CONFIG_HOME=1`. Git would then read `1/git/config`, a path relative to the cwd that the agent can write. This is the kind of gap Done means asks to close ("an assignment builtin whose name part is not a literal word"; `((…))` is `let`, and `let "$v|=1"` is refused). No test row covers compound operators, and F1 and F2 do not mention it.

## Notes
- `echo $[XDG_CONFIG_HOME=1]; export XDG_CONFIG_HOME; git status` passes, and so does `echo $[ $v = 1 ]`. Real bash sets the variable (`echo $[QUX=7]` sets `QUX=7`). F1 says "`$[…]` was not tried", so this belongs under F1.
- The passing row `(( total += $v ))` passes even when `v='XDG_CONFIG_HOME=5'`: bash evaluates the expanded text and sets the variable. `let "total += $v"` is refused, because `let` refuses every run-time operand. This is the same family as F1's `n=XDG_CONFIG_HOME=5; (( n ))`.
- `( (echo HOME) ); git status` is refused, because nested subshell parens are read as `((`. That is a false refusal (ux), not a hole.
- The `export $v=…` refusal at the export itself is accepted by AR-D318.
- `worktree-guard.ts` is at exactly 200 lines.

## Checks
- `npm ci`: exit 0.
- `npm run check` and `npm test`, run in one bash call: tsc clean; 1280 tests, 1218 pass, 0 fail, 62 skipped. This matches the worker's claim.
- `node --import @arthur/core/testing --test --test-name-pattern "without an assignment word" packages/core/test/worktree-guard.test.ts`: pass.
- I tried 15 mutations, each run against that test, and the test caught every one, failing on the row meant for it:
  - the `indirect` check removed
  - the separate `printf -v` operand removed
  - the `for` rebinding a nameref removed
  - `((` detection off
  - the `[index, index+1]` window shrunk to `[index]`
  - option-cluster scanning removed
  - `:?=` narrowed to `:=`
  - `getopts`, `select` and `mapfile` each dropped
  - the unbound-nameref check removed
  - the nameref `$` text scan off
  - the dynamic operand check removed
  - `++`/`--` removed
  - the `let` math check removed
- Throwaway `worktreeRefusal` probes:
  - `command`, `builtin`, `\read`, `time`, `!`, quoted and backslash-split names, `while read`, `if read`, a function body, `for ((…))`, `printf -v HOME[0]` and `printf -- -v HOME` are all refused.
  - The compound-operator and `$[…]` cases above pass.
- `git status --short` after restoring every mutation: clean. Probe files removed.

FAIL