# AR0333 - Review 2

- Job: 2026-10-25-review-fc2755f3
- Branch: arthur/2026-10-25-worker-9a6298d8
- Commit reviewed: 6ff7029d1cab94cbb501d6da72d696618432db16
- Verdict: FAIL

## Final message

**Review: AR0333 at `6ff7029d` (`0fdb594c..6ff7029d`)**

The branch does what the ticket asks for the three named commands, and every check passes. It still fails, for two reasons. First, a prefix `OLDPWD=` before `bash -c`, `eval` or `env … bash -c` gets past the guard. Second, one key behavior survives its mutation, which lets a second form get past it.

## Findings

1. **`packages/core/src/worktree-guard.ts:99`: a prefix `OLDPWD=` is only followed before `cd`, `pushd` and `popd`, so the shell that reads it goes unchecked.** The guard applies a prefix assignment only when the verb is `cd`, `pushd`, `popd`, `export`, `declare`, `typeset`, `readonly` or `local`. These three calls are passed (I ran them through `worktreeRefusal`, with `main` = `../../acme`):
   - `OLDPWD=${main} bash -c 'cd -; rm README.md'` → `undefined`
   - `OLDPWD=${main} eval 'cd -; rm README.md'` → `undefined`
   - `env OLDPWD=${main} bash -c 'cd - && rm README.md'` → `undefined`

   Real bash does go to the named folder in all three: `env -u OLDPWD bash -c 'OLDPWD=/usr bash -c "cd -; pwd"; OLDPWD=/usr eval "cd -; pwd"; env OLDPWD=/usr bash -c "cd -; pwd"'` printed `/usr` three times. So the main checkout's `README.md` is deleted.

   This is the bug the ticket fixes ("`$OLDPWD` read as the folder it names, or refused as unknown"), reached through a shell instead of a direct `cd -`. The branch tests `OLDPWD=${main} cd -` but not this form, and findings.md F2 does not list it.

2. **`packages/core/src/worktree-guard.ts:99`: a surviving mutation that is also a bypass.** The fix expands `$OLDPWD` inside a new `OLDPWD=` value at the moment of assignment, via `set[2]!.replace(/^~-(?=\/|$)/, previous || "~-")`.
   - **Mutation:** replace that with plain `set[2]!`. All 11 tests still pass.
   - **Effect, confirmed with the mutation applied:** `cd ${main}; cd /tmp; OLDPWD=$OLDPWD/; cd -; rm README.md` goes from refused (main checkout) to passed.
   - **Why no test catches it:** the only row that touches this, `OLDPWD=$OLDPWD/x` with OLDPWD unset, is stopped by the "OLDPWD is unset" refusal before the expansion ever runs.

   A test that would pass with the behavior removed fails the branch under the review criteria.

## Notes (not blocking)

- **`worktree-guard.ts:84`, the `previous || "~-"` in `located`:** changing `||` to `??` survives the tests. The two are equivalent: an empty OLDPWD together with `~-` or `$OLDPWD` is always refused first.
- **Prefix `OLDPWD=x eval …`:** in bash the assignment lasts only for that one `eval`. If finding 1 is fixed by setting `previous` for `eval`, the value should not carry over into later commands.
- **The worker's claims match what I saw:** both files are 200 lines, and the guard tests give 11 pass, 0 fail. Their "OLDPWD unset" messages and F1/F2 findings are accurate.
- **Probes that behave correctly:** `cd -- -`, `cd -L -`, `command cd -`, `popd` followed by `$OLDPWD`, `declare -x`, `local`, `cp x "$OLDPWD"` and `--foo=$OLDPWD/…` are all refused. `pushd main; cd /tmp; pushd` correctly lands back in the worktree.

## Checks run

- `npm ci`: added 22 packages.
- `npm run check`: `tsc` reported no errors.
- `npm test`: 1106 tests, 1048 pass, 0 fail, 58 skipped.
- `node --import @arthur/core/testing --test packages/core/test/worktree-guard.test.ts`: 11 pass, 0 fail.
- **Mutation sweep, 19 mutations, each run against that test file:** 17 were caught, 2 survived.
  - **Caught:** bare `pushd` not swapping; bare `pushd` not pushing; `cd -` ignoring `previous`; a subshell not restoring `previous`; the env's OLDPWD ignored; an assignment inside a pipe being applied; a prefix assignment before `cd` ignored; a prefix assignment before any command applied; `export` not followed; `cd` not setting `previous`; an empty OLDPWD not refused; the refusal only at the start of a word; `unset` ignored; `+=` replacing instead of adding; both `$OLDPWD`/`${OLDPWD}` → `~-` reads in `shell-words.ts`; a move inside a pipe counted.
  - **Survived:** the `previous || "~-"` → `??` change (equivalent, see the first note) and the assignment-time expansion (finding 2).
- **Probe rows added to the test for the run, then removed:** the results quoted in findings 1 and 2.
- **Real bash:** the three prefix forms in finding 1 all ended in `/usr`.
- **Cleanup:** all throwaway edits were undone with `git checkout --`, and `git status --short` is clean.

FAIL