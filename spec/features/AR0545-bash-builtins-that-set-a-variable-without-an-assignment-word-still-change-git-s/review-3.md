# AR0545 - Review 3

- Job: 2026-10-29-review-2e92235e
- Branch: arthur/2026-10-29-worker-062fd159
- Commit reviewed: 91d256d48188c00620e61a4d5b2efbeb3c3f3cc0
- Verdict: PASS

## Final message

No blocking findings. The fix for review 2 works, review 1's finding is still fixed, and the merge of main kept AR0546's checks.

**Review 2's finding (a config name split by double quotes in arithmetic): fixed.** `packages/core/src/worktree-guard.ts:55` now removes the `"` characters from each `((…))`, `$((…))` and `$[…]` span before it looks for names. It has refused rows for `((…))`, `$((…))`, `$[…]`, `eval` and `let`.

**Review 1's finding (compound operators after a run-time name): still fixed.** A `$` or backtick anywhere in an arithmetic span counts as setting config (accepted under AR-D318). The test pins `|=`, `&=`, `>>=`, `==`, `+= $v` and a backtick for `((…))`, and also `$(( $v |= 1 ))` and `$[ $v = 1 ]`.

**AR0546 after the merge: kept.** Compared with the base, the range only adds to the guard. The second pass (`run(parse(command)) ?? (unread === undefined ? bashRefusal(…, configured) : undefined)`, `:148`) is unchanged. `configured` starts from `unread` and `refs` sits beside it (`:53`). The AR0546 test block is unchanged and passes. The row that moved, `git status; read HOME <<< /tmp/h`, is refused because of AR0546's second pass; turning that pass off makes the AR0545 test fail.

**Done means:** every form the ticket names has a refused row and a passing row on an unrelated name: `for`, `select`, `read`, `printf -v`, `mapfile`, `readarray`, `getopts`, `let`, `((…))`, `$[…]`, a nameref, `${name:=…}`, `${name=…}`, and `export $v=…`. `export $v=…` is refused where it stands, as AR-D318 accepts. The ticket file is unchanged in the range.

## Notes
- The fix landed inside the merge commit `91d256d4`, not in its own `fix(AR0545)` commit. The worker's final message says so.
- `read -p HOME x <<< a; git status` is still refused, because the prompt operand is counted as a name. This over-refusal (ux) was already noted in review 2.
- F1 is still open and now also covers `${x:HOME=1}`. F2 is `dropped`, with AR0546 given as the reason.

## Checks
- **`npm ci`:** 24 packages added, exit 0.
- **`npm run check && npm test`**, one bash call with the 1800 s timeout: tsc clean. My first filter dropped the summary lines, so I ran `npm test` again on its own: 1289 tests, 1227 passed, 0 failed, 62 skipped. This matches the worker's numbers. No `limits.test.ts` timing test failed.
- **Size:** `wc -l` shows `worktree-guard.ts` at 186 lines, as claimed. The structure test passed inside the full run.
- **Mutations**, each run against the "without an assignment word" test, which passes unmutated. All five were caught, and I restored the file with `git checkout` after each:
  - Keeping the double quotes in the span fails the `HO""ME` refused rows.
  - Removing quotes and backslashes (`/["'\\]/g`) fails the `HO''ME` passing row.
  - Dropping the `$`/backtick span check fails the run-time-name rows.
  - Dropping `let` from the operand list fails the `let` rows.
  - Turning off the AR0546 second pass fails the moved row `git status; read HOME <<< /tmp/h`.
- **Real bash 5.2.21, with the harmless name `FOO` only:**
  - Escaped quotes do not set `FOO`. `(( FO\"\"O = 5 ))`, `(( FO\"O = 5 ))` and `(( "FO\"\"O" = 5 ))` leave it unset; `$(( FO\"\"O = 5 ))` and `$[ FO\"\"O = 5 ]` are syntax errors. So the fix does not need to handle a backslash before a quote.
  - `(( FO""O = 5 ))` sets `FOO=5`, which confirms the case the fix handles.
- **Throwaway `worktreeRefusal` probe**, a test I appended, ran, then restored with `git checkout`:
  - Refused, as they should be: `(( "HO"ME = 5 ))`, `"$(( HO""ME = 1 ))"`, `x=$(( HO""ME = 1 ))`, `bash -c` and a `bash` heredoc holding it, `$((…))` in an unquoted `cat` heredoc, a function body, `a[HO""ME=1]`, quoted parens `"(" … ")"`, `for (( HO""ME = 5; 0; ))`, a git call before the arithmetic, `&&`, and `eval "(( HO\"\"ME = 5 ))"`. Each was followed by `git status`.
  - Passing, as it should: `(( x = "1" ))`.
  - `git status --short` was clean afterwards.

PASS