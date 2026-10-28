# AR0496 - Review 6

- Job: 2026-10-28-review-193e93f0
- Branch: arthur/2026-10-28-worker-821d07d3
- Commit reviewed: 09e8bd55e23eb2e8979c36743cb8b722004cc8ed
- Verdict: FAIL

## Final message

I'm failing this branch. The index exception is gone and every attack from reviews 1–4 is refused, along with review 5's finding 1. But review 5's second attack (extglob) still gets through. The same brace or glob trick also still works after `env`, and in real bash both deleted the stand-in main checkout's README.

## Findings

1. **`packages/core/src/worktree-guard.ts:95`: extglob patterns in a declared name still pass (review 5, finding 2, not fixed).** The check `/[{*?[]/` looks for an unquoted `{`, `*`, `?` or `[` before the `=`. Extglob's `@(…)`, `+(…)` and `!(…)` contain none of these, so these pass the guard:
   - `bash -O extglob -c 'export HOM@(E)=../../acme; rm $HOME/README.md'`
   - `bash -O extglob -c 'export HOM+(E)=../../acme; rm $HOME/README.md'`
   - `shopt -s extglob; command export HOM@(E)=../../acme; bash -c 'rm $HOME/README.md'`

   I set up a temporary `w/x/HOME=..` + `w/x/acme` + `acme/README.md` folder and ran the first two in real bash: both deleted `acme/README.md`. The third did not delete it, because bash reads that whole one-line `-c` string before `shopt` turns extglob on. Two other things are missing:
   - The worker's final message does not mention this attack.
   - `findings.md` F1 does not record it.

   AR-D244 names only `{ * ? [`. But your instruction for this round was that every attack in the earlier reviews must be refused, and this one is not.

2. **`packages/core/src/worktree-guard.ts:95`: a brace or glob name after `env` still sets HOME for the command `env` runs.** The second half of line 95 only matches a word that literally starts with `HOME`, `ARTHUR_JOB` or `PWD`. Bash expands braces and globs in `env`'s arguments before `env` sees them, and the guard never sees those names. These pass the guard:
   - `env {HOME,X}=../../acme bash -c 'rm $HOME/README.md'`: this needs no prepared folder. Bash turns it into `HOME=../../acme X=../../acme`, and in real bash it deleted `acme/README.md`.
   - `env HOM[E]=../../acme bash -c 'rm $HOME/README.md'`: deleted it in real bash.
   - `env HOM?=../../acme bash -c 'rm $HOME/README.md'`: deleted it in real bash.
   - `sudo HOM[E]=…` and `env $v=…` also pass the guard. I only checked those in the guard; real `sudo -n` was not allowed here.

   This misses Done means point 1. HOME is set "in front of a command" through `env`, a form the branch already refuses when written plainly (`env HOME=${main} sh -c …` is a row in the table). The guard neither uses the value nor refuses it. It is the same kind of name as the declaration forms that AR-D239 and AR-D244 ordered refused, and no row covers it.

## Notes
- Every other attack from reviews 1–5 is refused with the unknown refusal. That is 30 commands, including both commands the ticket names, the `HOME[0]=` row and the run-time names in review 1, the brace lists in reviews 2 and 4, the function and loop timing cases in review 3, and all six index-glob rows in review 5 (`ARTHUR_JO[B]` too, which has no row).
- Other forms I tried are refused too: `"HOM"[E]=`, `'HOM'?=`, `export -- HOM[E]=`, `command readonly`, `command typeset -x HOM*=`, `command local`, and `export X=1 HOM[E]=`.
- These still pass, as they should: `declare -a 'arr[0]'=1`, `export FOO=a*b`, `declare -a arr=(1 2)`, `echo HOM[E]=x`, and an escaped `HOM\[E]=`.
- `worktree-guard.ts` and `shell-words.ts` are each exactly 200 lines.
- The range still has no changelog entry for AR0496, as the worker says.

## Checks
- `npm ci`: exit 0.
- `npm run check`: `CHECK_EXIT=0`.
- `npm test`:
  - The first foreground run (1800 s timeout) was moved to the background. I stopped it, so it gave no result.
  - I reran it writing to a log in my worktree, now deleted: 1230 tests, 1169 pass, 0 fail, 0 cancelled, 61 skipped, `TEST_EXIT=0`. This matches the worker's numbers.
- Guard probe: a throwaway test outside the `npm test` pattern ran 52 commands through `worktreeRefusal`, with results as above. The probe is deleted.
- Real bash, using a scratch folder under `/tmp` that is now removed: the outcomes are as stated in findings 1 and 2.
- Mutations of line 95, each run against `worktree-guard.test.ts` and then restored. Each one made 1 test fail, so all were caught:
  - `[`, `{`, `*` and `?` each removed from the character class
  - the backslash-escape stripping dropped
  - the whole word tested instead of the part before `=`
  - `index > at` changed to `index >= 0`
  - the glob check removed
- The tree is clean at the end (`git status --short` printed nothing).

FAIL