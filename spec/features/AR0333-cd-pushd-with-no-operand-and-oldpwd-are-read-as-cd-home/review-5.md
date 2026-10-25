# AR0333 - Review 5

- Job: 2026-10-25-review-9405a093
- Branch: arthur/2026-10-25-worker-9a6298d8
- Commit reviewed: c889ef56d12a2bbcf67e796e9820fd001ad20f7a
- Verdict: PASS

## Final message

That background job was only a wait. It found no test processes left in my checkout and an empty `git status`, so the review stands as written.

## Findings

None.

## Notes

- `packages/core/src/worktree-guard.ts` and `packages/core/src/shell-words.ts` are both exactly at the 200-line limit. The next change to either one will need lines taken out or a recorded decision to raise the limit.
- Several `for … return found` loops became `.map(...).find(Boolean)` (`theirs`, `find`, `editPaths`, `worktreeRefusal`). The new form judges every item instead of stopping at the first refusal, but the result is the same: in `find -exec` the judged call is marked as not standing alone, so it cannot change `cwd` or `previous`.
- Findings F1 (`cd $PWD` and `cd ~+`) and F2 (OLDPWD set by `read`, `printf -v`, or removed by `env -u`, among others) in `findings.md` are still `Status: open`, so the merge will settle them. Neither is a form this ticket names.
- The array forms of OLDPWD and the other forms in the ticket's Out line belong to AR0420. I did not count them here.

## Checks run

- **`npm ci`:** added 22 packages.
- **`npm run check`:** `tsc` reported no errors.
- **`timeout 900 npm test`:** 1106 tests, 1048 pass, 0 fail, 58 skipped.
- **Real bash:**
  - `env -u OLDPWD bash -c 'cd /usr; cd /tmp; unset OLDPWD | true; cd - >/dev/null; pwd'` printed `/usr`.
  - `pushd /usr; pushd; pushd; pwd` printed `/usr`.
- **Mutations:** 23 mutations of `worktree-guard.ts` and `shell-words.ts`, each followed by a run of the guard test. Every one made at least one test fail. They were:
  - **The worker's piped-`unset` mutation:** dropped `command.alone` on the `unset` line.
  - **Subshell and stack state:**
    - a subshell shares `pushed`
    - a subshell restores only `cwd`
    - a bare `pushd` does not swap
    - a `cd` does not set `previous`
    - a move with nowhere to go is not skipped
    - a piped `cd` moves
  - **Assignments and `unset`:**
    - `+=` treated as `=`
    - `unset -f` not excepted
    - a piped assignment sets OLDPWD
    - a prefix before `cd` ignored
    - `export`/`declare`/`typeset` ignored
    - an OLDPWD from the env ignored
    - an empty OLDPWD not refused
  - **Shells and `eval`:**
    - `eval` does not restore OLDPWD
    - the prefix dropped for `bash -c`
    - the prefix dropped for `eval`
  - **Where `~-` is resolved:**
    - `ln` not resolved through `~-`
    - `git -C` not resolved through `~-`
    - `commandIndex` without `+=`
    - `$OLDPWD` expands to nothing
    - `${OLDPWD}` expands to nothing
- **Restore:** each mutated file was restored with `git checkout --`. `git status --short` was empty at the end.
- **Commits:** all five are Conventional Commits with the `AR0333` scope.

PASS