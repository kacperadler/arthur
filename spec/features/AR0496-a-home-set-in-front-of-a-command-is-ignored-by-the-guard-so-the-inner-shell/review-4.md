# AR0496 - Review 4

- Job: 2026-10-28-review-36fb3fca
- Branch: arthur/2026-10-28-worker-821d07d3
- Commit reviewed: 6506fb1d0d2f7865442cc81de61379ca4dd42599
- Verdict: FAIL

## Final message

## Findings

1. **`packages/core/src/worktree-guard.ts:95` and `packages/core/src/shell-words.ts:76`: if a declaration builds its name with a brace list, the guard does not see that it sets HOME, ARTHUR_JOB or PWD.** Line 95 refuses a declaration only when the name it sets holds `$` or a backtick (`mark`, which only `$` and a backtick call). Bash also expands brace lists in the arguments of `export`, `declare` and `local`, and the guard never sees those names. I ran these four calls through `worktreeRefusal` at `6506fb1d` and each one passed:
   - `export {HOME,X}=../../acme; bash -c 'rm $HOME/README.md'`
   - `export HOM{E,}=../../acme; bash -c 'rm $HOME/README.md'`
   - `declare -x {HOME,X}=../../acme; rm ~/README.md`
   - `f() { local {PWD,X}=../../acme; rm $PWD/README.md; }; f`

   In real bash, run from `w/x` in a temporary folder, all four deleted `acme/README.md`. This misses Done means point 1: HOME is "`export`ed before it in the same call", and the guard neither uses that value nor refuses. The branch's own rule for names built at run time (commit `80279d61`, the `dynamic` flag) is meant to cover exactly this kind of call and misses this form. A glob in the name (`export HOM?=../../acme`, which needs a matching file in place) also passes the guard. I could not confirm it in real bash, because my own guard refused the folder I needed for it [INFERENCE: same hole].

   A possible fix: `mark` (or the check on line 95) should also fire on an unquoted `{`, `*`, `?` or `[` in a declaration's word before its first `=`. The index form `HOME[0]=` has to stay what it is now. Add a row for each form.

## What you asked me to check first
- **The ten AR0524 rows:** I ran each through `worktreeRefusal`. All ten get the unknown refusal. Nine of them previously got the git-config refusal, so they are still refused, just with a different message. `git commit -m x; export HOME=/tmp/h` used to pass and is now refused, which only moves toward refusing. `HOME+=/h git commit -m x`, `HOME[0]=/tmp/h git commit -m x` and every `GIT_CONFIG_*` / `XDG_CONFIG_HOME` row still get the git-config refusal (the test file passes).
- **The eight probes from review 3:** all eight get the unknown refusal, and all eight are rows in the test table.

## Notes
- Other forms the new code refuses:
  - `builtin export` and `command export`
  - `sudo`, `env -i`, `nice env`, `timeout 5 env` or `exec env` setting HOME before a shell
  - HOME set inside a shell's heredoc
  - `eval 'HOME=…'`, `eval export HOME=…`
  - HOME set inside `if … fi` or `{ …; }`
  - `export -- HOME=…`, `HOME=(…)`, `export X HOME=…`
  - `ARTHUR_JOB=…` set alone
  - a function named `git` called with a HOME prefix (git-config refusal)
- Forms that still pass, as they should: `echo HOME=x`, `export FOO=1`, `export HOME; git status`, `HOMEDIR=… bash -c`.
- F1 in `findings.md` lists `for`, `read`, `printf -v`, a nameref and `eval $v=…` as open. The brace and glob forms are not there, and they fall under this ticket's own rule.
- `worktree-guard.ts` and `shell-words.ts` are each exactly 200 lines, and the extra text went into very long comment and string lines.
- There is no changelog entry for AR0496, as the worker says.

## Checks
- `npm ci`: exit 0.
- `npm run check`: `CHECK_EXIT=0`.
- `npm test`: I ran it in the foreground with a 1800-second timeout. The harness moved it to the background anyway, with its output going to a file in my worktree. Result: 1230 tests, 1169 pass, 0 fail, 0 cancelled, 61 skipped, `TEST_EXIT=0`. That matches the worker's numbers.
- Probe: a throwaway copy of the guard test with one extra test that printed the result for 47 calls (the ten AR0524 rows, the eight review-3 probes, and the forms above). The results are as listed above.
- Real bash in a temporary folder: each of the four brace forms deleted `acme/README.md`.
- 10 mutations, each run against `worktree-guard.test.ts` and restored with `git checkout --`. Every one was caught:

  | Mutation | Failing tests |
  |---|---|
  | removed the `dynamic` check | 1 |
  | removed `at < 0` (an assignment that stands alone) | 2 |
  | removed the `git` exception | 2 |
  | removed `|| declares` | 2 |
  | dropped `PWD` from the regex | 1 |
  | dropped `ARTHUR_JOB` from the regex | 1 |
  | dropped the index and `+=` from the regex | 1 |
  | made `mark` never fire | 1 |
  | made `mark` fire after `=` too | 1 |
  | removed `mark` for `$` in double quotes | 1 |

- Cleanup: I deleted the probe file and the test log, and `git status --short` was empty afterwards.

FAIL