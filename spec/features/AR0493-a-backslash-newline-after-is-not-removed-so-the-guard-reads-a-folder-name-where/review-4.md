# AR0493 - Review 4

- Job: 2026-10-28-review-eb9a2e1b
- Branch: arthur/2026-10-28-worker-7b31d67c
- Commit reviewed: b66033c187b32e03be4833080d71497107c9ad7e
- Verdict: FAIL

## Final message

**Findings**

1. **`packages/core/test/worktree-guard.test.ts:318-343`: one write to the main checkout from review-1.md is not refused and has no row.** The worker says the rows cover every command of review-1.md to review-3.md that ends in a write to the main checkout. That does not hold.
   - **The command:** review-1.md line 29 gives `((x<<1))\nrm ../../acme/README.md`.
   - **What the guard does:** I ran it through `worktreeRefusal` in the test's setup and got `undefined`, so it passes. The guard reads `<<1` as a heredoc and treats the `rm` as its body.
   - **What bash does:** bash 5.2.21 reads `((x<<1))` as arithmetic. In a temporary folder it printed `removed '../acme/README.md'`.
   - **Why it stays open:** this branch's `findings.md` does not carry the dropped branch's F1 for it, and no ticket under `spec/` names it, so nothing tracks the bypass any more.
   - **Done means and the coordinator's check both fail:** Done means asks for a refused row for every such command. The coordinator asked me to confirm every such command is refused. Neither holds.
   - **A second gap, smaller:** the command from review-1 finding 2 (`` echo `x`; rm '\<nl>'/../../../acme/README.md ``) is refused (unknown), but it has no row either.

2. **`packages/core/src/worktree-guard.ts:78`: a `$'…'` backslash-newline after a blank still deletes the main checkout's README in one call.** The worker says `$'…'` can produce a backslash-newline the raw text does not show, and that the inner texts of shells and `eval` are now checked for it.
   - **Why the check misses it:** the inner text is checked only after `decodeEscapes` (`shell-words.ts:29-35`) has dropped the backslash of `\<newline>`.
   - **The guard returned `undefined` for all four of these:**
     - `bash -c $'rm \<nl>$HOME/acme/README.md'`
     - `sh -c $'rm \<nl>$HOME/acme/README.md'`
     - `eval $'rm \<nl>$HOME/acme/README.md'`
     - `bash <<< $'rm \<nl>$HOME/acme/README.md'`
   - **What the guard reads:** `rm`, then `$HOME/acme/README.md` as a second command.
   - **What bash does:** bash 5.2.21 keeps the backslash, joins the lines and removes the file. `env -i HOME=<tmp> bash` printed `removed '…/acme/README.md'` for the `bash -c`, `eval` and `<<<` forms.
   - **What F1 in `findings.md` says:** it calls this only an inferred two-call link bypass, "not run through the guard". In fact it is a direct one-call deletion, and the message's claim about the `$'…'` case does not match what the code does.
   - **Before the change:** [INFERENCE] base has the same hole, because `decodeEscapes` is unchanged, so this is not a regression.

**Notes**
- Within this branch's scope:
  - The regex refusal, the rewritten AR0472 row and the `"${x:-"\\\n"}"` row behave as described.
  - The broader `<<` rule and the inner-text checks were accepted by the coordinator.
  - Every other write to the main checkout from the three reviews is refused, and each has a row.
- `worktree-guard.ts` is at 200 lines and the core line budget is unchanged. The `docs/deploy.md` guard paragraph names the refusal.
- No boundary or Shape rule breaks in the diff.

**Checks run**
- **`npm ci`:** added 22 packages.
- **`npm run check`:** tsc finished with no errors.
- **`npm test`, first run:** it went to the background and I stopped it, so its ✖ lines are from the kill, not real failures.
- **`npm test`, second run:** output went to a file in the worktree, since deleted. Result: tests 1230, pass 1169, fail 0, cancelled 0, skipped 61, matching the worker's numbers.
- **Guard probes:** I added temporary log rows to the main guard test and ran the guard on the commands above, with the results stated there. They also showed that `echo a # x \<nl>rm $HOME/…` and `bash -c 'rm \<nl>$HOME/…'` are refused as main.
- **bash 5.2.21 runs in `mktemp -d` folders:**
  - the `$'…'` forms through `bash -c`, `eval` and `<<<` each removed the README;
  - `((x<<1))\nrm` removed it too.
- **Mutations of `worktree-guard.ts`,** each run against `worktree-guard.test.ts`. All nine were caught (`fail 1` each):
  - no heredoc half of the regex
  - no blank-lookbehind half
  - `(?<!<)` removed
  - `(?!<)` removed
  - space-only lookbehind
  - `eval` text parsed without the check
  - shell text parsed without the check
  - two attempts whose substitution did not apply and changed nothing, so their `fail 0` means nothing; I reran them correctly as the first two above.
- **Cleanup:** I restored every file with `git checkout --` and deleted the output files. `git status` is clean.

FAIL