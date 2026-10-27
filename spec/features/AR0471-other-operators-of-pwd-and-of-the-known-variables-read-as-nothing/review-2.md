# AR0471 - Review 2

- Job: 2026-10-27-review-370bf126
- Branch: arthur/2026-10-27-worker-c28e3457
- Commit reviewed: 61417426322326836ed3bb7249ca2d64ecfeb2e4
- Verdict: FAIL

## Final message

The branch can't merge as it is: this round's fix, which reads the fallback word, opens a new way to delete files in the main checkout.

## Findings

1. **`packages/core/src/shell-words.ts:93`: this round lets a write into the main checkout through.** Commit `38287dc1` now reads the fallback word with `shellCommands(fallback[1]!, known)` and keeps only each command's `.words`. Bash does not treat `>`, `<`, `2>` or `#` inside `${x:-…}` as redirects or comments. They are plain text there, which I checked with real bash: `printf "[%s]" ${x:-> /m/README.md}` prints `[>][/m/README.md]`. The parser now takes them as redirects and a comment, so a path behind one is dropped:
   - `rm ${x:-> ../../acme/README.md}`: the base reads it as `["rm","../../acme/README.md"]` and refuses it with "the main checkout". At this commit it reads as `["rm"]` and passes (`undefined`). Bash runs `rm '>' ../../acme/README.md`. In a temporary folder, `rm -f ${x:-> ../f}` really deleted `../f`.
   - `rm ${x:-a 2> ../../acme/README.md}`: the base reads `"a ../../acme/README.md"`. This commit reads `"a"`, and the path is gone.
   - `rm ${x:-a # ../../acme/README.md}` passes too, but it already passed on the base, so it is not new.

   So the change trades one bypass for another: the old way, `shellWords`, kept the redirect targets. This is a security problem, not F1, so the coordinator's out-of-scope ruling doesn't cover it. No test row covers a redirect or `#` inside a fallback word. One possible fix is to keep the `writes` and `reads` of the fallback's commands as well as the words.

## Notes
- F1 in `findings.md` (a command substitution in a fallback word) was already there before this branch. It is out of this ticket, as you said, and not counted against it.
- Other probes the branch gets right, each refused as expected: `${ARTHUR_JOB:0:5}`, `${ARTHUR_JOB[@]%/*}`, `"${ARTHUR_JOB%"/"*}"`, `${x:-"${ARTHUR_JOB%/*}"}`, `${x:=${HOME%/}}`, heredoc `${PWD#x}`, heredoc `${x:-${PWD%/x}}`, and `${HOME:-x}/acme/README.md` (main checkout).
- `x=$ARTHUR_JOB; … ${x%/*}` and `x=ARTHUR_JOB; … ${!x%/*}` pass, because the guard doesn't follow variable assignments. That limit was there before this branch, and computing operators is out of the ticket.
- The `worktree-guard.ts` message change is outside the ticket's Scope "In" list. The worker's message explains it (review note 1), so it is fine.
- Line 8 of `shell-words.ts` is a very long comment. That is taste only.

## Checks
- `npm ci` worked. `npm run check` (tsc) passed with no errors.
- `node --import @arthur/core/testing --test packages/core/test/worktree-guard.test.ts test/structure.test.ts`: 27 tests, 27 pass, 0 fail.
- I had started the full `npm test` before your message came in, then stopped it. The test-file failures it printed ("Promise resolution is still pending") came from stopping it, not from the branch.
- `wc -l`: `shell-words.ts` and `worktree-guard.ts` are both at 200 lines, as the worker said.
- I broke the code one change at a time and ran the guard test after each; every mutation made it fail:
  - M1: dropped `|| value(of) !== undefined` (operators on known variables).
  - M2: dropped `|| of === "PWD"`.
  - M3: went back to reading the fallback with `shellWords(fallback[1]!)`.
  - M4: dropped the heredoc replace that marks `${PWD` with another operator as unreadable.
  - M5: dropped the heredoc `:?\+` exception.
  - M6: dropped the `fallback === null` check.
  - M8: dropped the heredoc `${PWD:-…}` forms.
  - M9: dropped `[#!]?` from the `of` regex.
- Probe rows, added for the run and removed after: `rm ${x:-> ../../acme/README.md}`, `${x:-< …}`, `${x:-a # …}` and `${x:-a 2> …}` pass at this commit. With the base's code, the first is refused as "the main checkout".
- I compared base and head parsing with a small throwaway script on `shellCommands`; the output is quoted in finding 1.
- Every file I changed is restored, and `git status --short` is empty.

FAIL