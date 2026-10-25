# AR0333 - Review 3

- Job: 2026-10-25-review-2115cff7
- Branch: arthur/2026-10-25-worker-9a6298d8
- Commit reviewed: 831b31f4654f7d9e9277146a15705005b12ec25f
- Verdict: FAIL

## Final message

I'm failing this branch. The three commands the ticket names are now refused, and every check passes. But `${OLDPWD…}` forms, `readonly OLDPWD`, `local OLDPWD=` outside a function and a bare `pushd -n` still let a later command reach the main checkout. In each one the guard approves the call and real bash deletes the main checkout's `README.md`. On top of that, two mutations of the new code pass the tests, and one of them opens another bypass.

## Findings

1. **`packages/core/src/shell-words.ts:93-94`: any `${OLDPWD…}` with an operator is still read as `cd $HOME`, or as the fallback text, which is the ticket's own bug.** Only the plain `${OLDPWD}` becomes `~-`.
   - A word with a default (`:-`, `-`, `=`) takes the default text, even when OLDPWD is set.
   - Any other operator (`%`, `#`, `/`) expands to nothing, so the guard reads the command as a bare `cd` to `$HOME`.

   Each of these, run in the worktree, passes the guard, and real bash (`env -u OLDPWD bash -c …`) deletes the main checkout's `README.md`:
   - `cd <main>; cd <other>; cd ${OLDPWD:-/tmp} && rm README.md`
   - `cd <main>; cd <other>; cd ${OLDPWD-/tmp} && rm README.md`
   - `cd <main>; cd <other>; cd ${OLDPWD=/tmp} && rm README.md`
   - `cd <main>; cd <other>; cd ${OLDPWD%/} && rm README.md`
   - `cd <main>; cd <other>; cd "${OLDPWD#x}" && rm README.md`
   - `cd <main>; cd <other>; cd ${OLDPWD/x/y} && rm README.md`

   The Goal says `$OLDPWD` is "read as the folder [it names] (or refused as unknown), not as `$HOME`". None of these forms is in findings.md F2.

2. **`packages/core/src/worktree-guard.ts:99`: `readonly` and `declare -r` are followed as a plain assignment, but after them `cd` can no longer change OLDPWD.** Line 111 still moves `previous` on every `cd`. So the guard ends up somewhere other than where bash goes, and both of these pass while bash deletes the main checkout's `README.md`:
   - `readonly OLDPWD=<main>; cd <other>; cd -; rm README.md`
   - `cd <main>; cd <other>; readonly OLDPWD; cd /tmp; cd -; rm README.md` (the same with `declare -r OLDPWD`)

   The range itself added `readonly` to the list of commands that set OLDPWD. This case is not in F2.

3. **`packages/core/src/worktree-guard.ts:99`: `local OLDPWD=x` outside a function is taken as an assignment, but bash refuses it there ("can only be used in a function") and keeps OLDPWD.**
   - `cd <main>; cd <other>; local OLDPWD=/tmp; cd -; rm README.md` passes the guard, and bash deletes the main checkout's `README.md`.
   - **Mutation:** removing `"local"` from that list also survives all 11 tests, so no test pins `local` either way.

4. **`packages/core/src/worktree-guard.ts:107-108`: the new bare-`pushd` swap ignores `-n`.** `pushd -n` with no folder does not change folder in bash. I checked: after `cd /usr; pushd /var; pushd -n`, `pwd` printed `/var` and `dirs` printed `/var /usr`. The guard instead swaps `cwd` with the top of the stack:
   - `pushd <main>; pushd -n; rm README.md` passes the guard; bash stays in the main checkout and deletes `README.md`.

   The ticket asks for a "`pushd` with no operand", and this is one.

5. **`packages/core/src/worktree-guard.ts:119`: a surviving mutation that is also a bypass.** The `eval` restore checks for `/^OLDPWD\+?=/`.
   - **Mutation:** change it to `/^OLDPWD=/`. All 11 guard tests still pass.
   - **Effect, with the mutation applied:** `cd <main>; cd <other>; OLDPWD+=/ eval 'cd /var'; cd -; rm README.md` goes from refused to passed. Real bash deletes the main checkout's `README.md` with that command.
   - No row has a prefix `+=` before `eval`.

## Notes (not blocking)

- The worker's claims hold:
  - Both files are 200 lines.
  - The guard tests give 11 pass, 0 fail.
  - The review-2 rows are present.
  - The review-2 mutations (plain `set[2]!`, no prefix before a shell's or `eval`'s commands, `alone: command.alone`, no `eval` restore, always restoring) are each caught.
- Prefix forms that behave correctly in my probe against real bash:
  - `exec`, `sh -c`, a heredoc into `bash`, `timeout 5`, `nice`, `time`, `env … bash -c`;
  - `command eval` and `builtin eval`, a nested `bash -c 'bash -c …'`;
  - `OLDPWD=x bash -c 'cd -'; cd -`, and `X=1 eval 'cd /var'; cd -; cd -`.
- Also missed, but not added by this range's lines:
  - `f() { cd -; rm README.md; }; OLDPWD=<main> f` passes.
  - `OLDPWD=<main> source /dev/stdin <<< 'cd -; rm README.md'` passes; F2 lists script files.
  - `cd <main>; pushd -n <other>; rm README.md` passes (the guard moves into `<other>`), the same on base `0fdb594c`.
- On base `0fdb594c`, every finding above passes the guard as well, because there `cd -` and `$OLDPWD` were read as `$HOME`. They are what remains of this ticket's bug, not regressions.

## Checks run

- `npm ci`: added 22 packages.
- `npm run check`: `tsc`, no errors.
- `npm test`: 1106 tests, 1048 pass, 0 fail, 58 skipped.
- `node --import @arthur/core/testing --test packages/core/test/worktree-guard.test.ts`: 11 pass, 0 fail.
- `node --test test/structure.test.ts`: 15 pass, 0 fail.
- `wc -l`: `worktree-guard.ts` 200, `shell-words.ts` 200.
- A throwaway probe in its own temporary folder (now deleted). For each command, it compared `worktreeRefusal` against real `env -u OLDPWD bash -c` on separate `main`/`wt`/`other` folders, checking whether bash deleted `main/README.md`. Run on this branch and on base `0fdb594c` (from `git archive`). This is the source of findings 1–4 and the notes.
- 16 mutations, each run against `worktree-guard.test.ts` and each restored with `git checkout --`:
  - **Caught (14):** no `eval` restore, always restoring, no prefix before a shell's commands, no prefix before `eval`'s commands, no parentheses around a shell, plain `set[2]!`, `\+?=` → `=` in `commandIndex`, `unset -f` not ignored, the unset-OLDPWD refusal disabled, bare `pushd` not swapping, `cd -` ignoring `previous`, `alone: command.alone` in the shell form, the subshell not restoring `previous`, the env's OLDPWD ignored.
  - **Survived (2):** `\+?=` → `=` in the `eval` restore (finding 5; with it applied, the probe confirmed the bypass) and `"local"` dropped from the list (finding 3).
- `git status --short` is clean.

FAIL