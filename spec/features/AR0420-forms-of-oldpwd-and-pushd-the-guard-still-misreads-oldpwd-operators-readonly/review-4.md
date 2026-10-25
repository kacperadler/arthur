# AR0420 - Review 4

- Job: 2026-10-25-review-d1cf5cc6
- Branch: arthur/2026-10-25-worker-3e326757
- Commit reviewed: fe369cb3a62cd2c735012dcdd15f350441fb6585
- Verdict: PASS

## Final message

I found nothing that blocks the merge. Round 4 adds the two test rows review 3 asked for, and both of review 3's mutations now fail the tests.

## Findings

None.

## Notes

- **Round 4 is test-only.** `bd0f6467..fe369cb3` changes only `packages/core/test/worktree-guard.test.ts`, with two added lines. That is what AR-D28 allows.
- **Both new rows are real escapes.** In a scratch folder, `env -u OLDPWD bash -c` deleted `README.md` with each one:
  - `cd <main>; cd /tmp; local OLDPWD=/tmp; pushd -; rm README.md`
  - `f() { local x=1 OLDPWD=<main>; cd -; rm README.md; }; f`

  So the "OLDPWD unknown" refusal is the right expectation for both, and it follows AR-D21.
- **The whole range still covers the six forms.** Each form has a test row, `local` and the `+=` of the `eval` restore are pinned, and `worktree-guard.ts` and `shell-words.ts` are 200 lines each.
- **Left for a later ticket:**
  - F2 in `findings.md` (`declare -n OLDPWD`, `pushd -n -`) is still `open`.
  - Review 3's `function f { local OLDPWD=…; }; f` form is still not handled.

## Checks run

- `npm ci`: 22 packages added.
- `npm run check`: tsc passes.
- `timeout 900 npm test`: two runs.
  - First run: my output filter caught no summary line, so I have no result from it.
  - Second run: 1108 tests, 1050 pass, 0 fail, 0 cancelled, 58 skipped.
- `node --import @arthur/core/testing --test packages/core/test/worktree-guard.test.ts`: 11 tests, 11 pass, 0 fail. This matches the worker's claim.
- **Mutations:** 11 throwaway mutations, run against `worktree-guard.test.ts`. Each one applied, each made the test fail (`fail 1`), and each file was restored with `git checkout --`:
  - review 3's finding 1: the `cd -` / `pushd -` unknown refusal at `:109` limited to `cd`. Caught.
  - review 3's finding 2: the `local` check at `:101` looking only at `args[0]`. Caught.
  - the `local` line removed: caught.
  - the unknown-OLDPWD refusal at `:109` removed: caught.
  - `readonly` and `declare -r` ignored (`fixed = false`): caught.
  - the `eval` restore matching `/^OLDPWD=/` instead of `/^OLDPWD\+?=/`: caught.
  - the `pushd -n` / `popd -n` branch disabled: caught.
  - a read-only OLDPWD still moved by `cd`: caught.
  - in `shell-words.ts`, the `:-`, `-`, `=`, `?` operators not read as `~-`: caught.
  - in `shell-words.ts`, the other `${OLDPWD…}` operators not made unknown: caught.
  - the `OLDPWD[0]=` and `OLDPWD=(…)` assignments not followed: caught.
- **Clean tree:** `git status --short` was empty afterwards, and the scratch folder in `/tmp` is removed.

PASS