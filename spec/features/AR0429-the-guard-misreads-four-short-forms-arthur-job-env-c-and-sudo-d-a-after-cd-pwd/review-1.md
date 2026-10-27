# AR0429 - Review 1

- Job: 2026-10-27-review-7254140b
- Branch: arthur/2026-10-26-worker-71cba7c4
- Commit reviewed: 01b0f4f43f2d54af2b93a70e0f39172ea831801d
- Verdict: FAIL

## Final message

**Review: AR0429 (`529138c8..01b0f4f4`, `fix(core): guard reads $ARTHUR_JOB, env -C, ~ after =, $PWD (AR0429)`)**

## Findings

1. **`packages/core/src/worktree-guard.ts:119` (`bash -c` / heredoc shells) and `:122` (`eval`): no test checks that inner shells get the known variables.** The diff changed both calls from `shellCommands(…, process.env.HOME)` to `shellCommands(…, known)`. Mutations tried:
   - Drop `known` at `:119`: `worktree-guard.test.ts` and `env-guard.test.ts` still pass, 14 of 14.
   - Drop `known` at `:122`: also 14 of 14.

   With both mutations applied (`HOME`/`ARTHUR_JOB` set as in a job), a probe showed that three commands the branch refuses then pass:
   - `bash -c 'echo x > $ARTHUR_JOB/result'`
   - `eval 'echo x > $ARTHUR_JOB/result'`
   - `bash -c 'rm $HOME/acme/README.md'`

   Form 1 inside `bash -c` and `eval` is a key behavior of this security ticket, and removing it breaks no test. The review criteria count an uncaught mutation of a key behavior as a FAIL.

2. **`packages/core/src/worktree-guard.ts:96`: no test covers `writes: []` in the moved branch.** The worker's message says redirects stay with the shell's own folder. Mutation `{ ...command, words: raw, writes: [] }` → `{ ...command, words: raw }`: the tests still pass, 14 of 14. The probe showed the effect: `env -C ../acme true > x`, which bash writes into the worktree's `x`, becomes refused. The only redirect row, `env -C /tmp true > README.md` with `cwd: main`, is refused either way, so it cannot tell the two apart. A row like `env -C <main> true > x` expected to pass would catch it.

3. **Bypasses of form 2 and form 4 the branch does not see.** Probed against the branch; each also passes on main, so none is a regression:
   - **Clustered short options:** `env -iC ../acme rm README.md` and `sudo -nD ../acme rm README.md` pass. `commandIndex` reads `../acme` as the command. Real `env -iC <dir> /bin/pwd` printed `<dir>`.
   - **Shortened long option:** `env --c=../acme rm README.md` passes. Real `env --c=<dir>` and `env --chd <dir>` both changed folder.
   - **Unquoted heredoc:** `cd ../acme; bash <<EOF` / `cd /tmp; rm $PWD/README.md` / `EOF` passes. Bash expands `$PWD` in the outer shell (main's checkout) before the inner `cd`. The branch handles exactly this for `bash -c "…"` but not for an unquoted heredoc body (`shell-words.ts` keeps the body raw).
   - **Other `${PWD…}` / `${ARTHUR_JOB…}` operators:** `${PWD%/x}` and `${ARTHUR_JOB%/*}` give nothing. This is close to the ticket's "other operators" Out item, so it doesn't block.

## Notes (not blocking)

- **Decision AR-D113** (in the ticket's Decisions) settles the worker's open question, so no action is needed: `env -C /tmp rm README.md` from main, and `rm ~+/README.md` with a `~+` symlink, now pass.
- **"Every test row fails on main":** the worker says several rows pass on main: guards against regressions, two rows that should pass, and the ticket's own `cd ~+; rm README.md`. That last row is required by the ticket itself, so this is a mismatch inside the ticket, not a defect in the branch.
- **Mutation `quoted(known[name] ?? "")`** (dropping the `!== undefined` check, `shell-words.ts:80`) survives. With it, an unset `ARTHUR_JOB` makes `${ARTHUR_JOB:-x}` give nothing instead of `x`. Minor.
- **Line count:** both files are exactly 200 lines. Part of the room came from joining comments into lines over 180 characters. No rule forbids long lines, but the 200-line limit is met this way rather than by shorter code.
- **Probes that matched bash:**
  - `here()` reads quoted `"~+"`, `'~+'`, `$'~+'`, a `~+` in the middle of a word, and `\~+` as a literal folder.
  - `eval rm \~+/README.md` resolves to the current folder after the re-parse.
  - `cd <main>; bash -c 'cd /tmp; rm $PWD/…'` passes.
  - `GIT_WORK_TREE=~/acme` is refused; `git --work-tree=~/acme` is literal and passes.
  - The env guard still refuses `~+/<secrets file>`, `$PWD/<secrets file>`, `a~/<secrets file>` and glob forms.
- **Scope:** only the three files the ticket allows changed; `test/structure.test.ts` is untouched and no budget was raised.

## Checks run

- `npm run check` (tsc): no errors.
- `node --import @arthur/core/testing --test packages/core/test/worktree-guard.test.ts packages/core/test/env-guard.test.ts test/structure.test.ts`: 30 tests, 30 pass, 0 fail, 0 skipped. This matches the worker's claim. I didn't run the full suite, as the owner asked; the host reports 1182 tests, 1176 pass, 0 fail, 6 skipped.
- `wc -l`: `worktree-guard.ts` 200, `shell-words.ts` 200.
- **16 single mutations** on `worktree-guard.test.ts` + `env-guard.test.ts`:
  - Caught (12): `ARTHUR_JOB` taken out of `known`; `$PWD` not read as `~+` (simple and brace forms); a brace variable's known value ignored; tilde only at a word's start; a non-prefix `~` not escaped; no `env -C`/`sudo -D` folders collected; the `redirected === undefined` condition dropped; `here` ignoring backslashes; `--chdir=` sliced wrong; sudo's `-D` swapped for `-C`; `here` not applied to the raw words.
  - Survived (4): `known` dropped at `:119`; `known` dropped at `:122`; `writes: []` dropped; the `!== undefined` check dropped.
- **Probe script** (throwaway fixture in its own `mktemp -d`, since removed), calling `worktreeRefusal` directly on about 90 commands; results as listed above.
- Real `bash`/`env` showed the tilde rules (`~"/x"` is literal, `a=~+:~+` expands both, `--x=~` is literal) and that `env -iC`, `env --c=` and `env --chd` change folder.
- I restored every mutation with `git checkout -- packages`; `git status --short` is clean.

FAIL