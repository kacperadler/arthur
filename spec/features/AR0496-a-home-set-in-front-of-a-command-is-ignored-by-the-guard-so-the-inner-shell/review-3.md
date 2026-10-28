# AR0496 - Review 3

- Job: 2026-10-28-review-0778a728
- Branch: arthur/2026-10-28-worker-821d07d3
- Commit reviewed: 04844369bbee0d34738fc88789759668cbe1bead
- Verdict: FAIL

## Final message

## Findings

1. **`packages/core/src/worktree-guard.ts:94-95,101`: when the refusal fires is now a security regression. A read of HOME, ARTHUR_JOB or PWD that the guard judges before the assignment passes, but bash runs that read after it.** The guard now records an assignment at line 101 and only refuses a command judged later in the text (`stale`, line 94). A function body is judged where it is defined, and a loop body is judged once. So a function body defined before the assignment, or a loop body that runs again after the assignment, gets past the guard. I probed `worktreeRefusal` at `04844369` and got PASS for every one of these:
   - `f() { rm $HOME/README.md; }; export HOME=../../acme; f`
   - `f() { rm $HOME/README.md; }; HOME=../../acme; f`
   - `f() { rm ~/README.md; }; declare -x HOME=../../acme; f`
   - `f() { bash -c 'rm $HOME/README.md'; }; export HOME=../../acme; f`
   - `f() { cd; rm README.md; }; export HOME=../../acme; f`
   - `f() { rm $PWD/README.md; }; PWD=<main>; f`
   - `for i in 1 2; do rm -f $HOME/README.md; HOME=../../acme; done`
   - `while :; do rm $HOME/README.md; export HOME=../../acme; done`

   In real bash, run from `wts/own` in a temporary folder, the function case and the `for` case each deleted `acme/README.md`. The worker's own pre-merge commit `a0f2d4f5` refuses all eight. I checked this by exporting its `packages/core/src` and running the same probe. The merge therefore reopened a hole the branch had closed.

   This misses Done means point 1: an assignment "`export`ed before it in the same call" must either be used as the value or refused. Here it is neither. No test row covers this case, so the suite stays green. The worker's message says the timing still refuses what it should. That is true for the table rows and false for the guarantee the ticket asks for.

   One possible fix: refuse the assignment itself, as `a0f2d4f5` did, whenever any non-git command follows it in the call, a function call or a loop body included. A git call keeps AR0524's UNSEEN refusal, and an assignment at the very end of the call still passes.

## Notes
- `spec/features/AR0496-…/findings.md` F1 still says "AR0496 refuses a call that sets HOME, ARTHUR_JOB or PWD by an assignment". Since the merge that is no longer true: the guard now refuses a later command that reads the variable.
- Your requested timing checks:
  - Both commands the ticket names are refused.
  - All of the AR0496 rows and AR0524 rows are refused or passed as the table expects: the guard test file passes.
  - Other forms I tried are refused: a prefix through `timeout`, `exec`, `command`, `nohup` or `env` before a shell, `builtin export`, `$(echo $HOME)`, a here string, `cd ~`, `pushd ~`, `&&`, `if`, and `xargs` with a prefix.
  - The four AR0524 git examples behave as main expects: three get UNSEEN, and `git commit -m x; export HOME=/tmp/h` passes.
- `worktree-guard.ts` and `shell-words.ts` are each exactly 200 lines, and the extra length went into very long header-comment lines.
- No changelog entry exists for AR0496, as the worker says.

## Checks
- `npm ci`: exit 0.
- `npm run check`: `CHECK_EXIT=0`.
- `npm test`:
  - The first foreground run was moved to the background. While my second run was going it finished with 1222 tests, 1 fail (`worktree-guard.test.ts` at 18900ms) and `TEST_EXIT=1`; the two runs overlapped.
  - The rerun, written to a file in the worktree (now deleted): 1230 tests, 1169 pass, 0 fail, 0 cancelled, 61 skipped, `TEST_EXIT=0`. This matches the worker's numbers.
  - `node --test packages/core/test/worktree-guard.test.ts` alone: 12 tests, 12 pass. I could not reproduce the single failure without the overlap.
- 13 mutations, run with the guard test file. The tests caught each one (fail 1):
  - removed the `stale` check
  - removed the `dynamic` check
  - removed the prefix refusal
  - stopped recording `SETS` assignments
  - removed the missing-`HOME` case
  - removed the `cd` case
  - made `mark` fire always
  - made `mark` fire in redirects
  - dropped the index from `SETS`
  - dropped `+=` from `SETS`
  - removed the `eval` exception
  - removed the heredoc mark
  - stopped checking redirect targets

  Each file was restored with `git checkout --`, and `git status` was clean afterwards.
- Bypass probe against `04844369` and `a0f2d4f5` (throwaway script in `/tmp`, deleted): results as in finding 1.
- Real bash, in a temporary folder: the function bypass and the `for` loop bypass each deleted the stand-in main checkout's `README.md`.

FAIL