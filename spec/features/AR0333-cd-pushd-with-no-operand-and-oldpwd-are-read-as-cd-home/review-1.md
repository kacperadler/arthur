# AR0333 - Review 1

- Job: 2026-10-25-review-6bc923f3
- Branch: arthur/2026-10-25-worker-9a6298d8
- Commit reviewed: 0afcb1cd1a15fdc32d3e78db926bccd81c6025e3
- Verdict: FAIL

## Final message

The ticket's three commands are now refused naming the main checkout, and the refactors change no behaviour. The branch still fails: two commands still let a `cd -` back into the main checkout through, and four mutations of the new code pass the tests.

## Findings

1. **`packages/core/src/worktree-guard.ts:100`: `unset -f OLDPWD` is taken as unsetting the OLDPWD variable.** The check `words.includes("OLDPWD")` ignores the `-f` flag, so the guard clears `previous`. Bash keeps OLDPWD, because `-f` removes a function, not the variable.
   - The command `cd <main>; cd /tmp; unset -f OLDPWD; cd -; rm README.md` gets no refusal from the guard.
   - Real bash (`env -u OLDPWD bash -c …`) ends up in `<main>` and runs the `rm` there.
   - This is the ticket's own case (`cd -` toward main), and the range itself added it: before, the same command was missed only because `cd -` was read as `cd $HOME`.

2. **`packages/core/src/worktree-guard.ts:99`: an `OLDPWD+=` assignment is not followed.** The check `word.startsWith("OLDPWD=")` misses an append. The Done means says "an assignment of OLDPWD sets it", and `+=` is one. Each of these passes the guard, and real bash ends in `<main>`:
   - `OLDPWD=; OLDPWD+=<main>; cd -; rm README.md`
   - `OLDPWD=/; OLDPWD+=<main without the leading slash>; cd -; rm README.md`
   - `declare OLDPWD+=<main>; cd -; rm README.md`

   Neither finding is in the worker's F2.

3. **Four mutations of key behaviour pass `worktree-guard.test.ts`.** The env-guard and env tests passed too.
   - **Line 92, redirects:** I replaced `theirs(command.writes.map(literal))` with `real(resolve(cwd, p))`, which skips `located`. 0 tests fail. No row writes through `> ~-/…` while OLDPWD is set, so `cd <main>; cd /tmp; echo x > ~-/README.md` could stop being refused unnoticed. The worker says redirects go through `located`, but no test holds that.
   - **Line 100, `unset` of any name:** I replaced `words.includes("OLDPWD")` with `true`. 0 tests fail. No row checks that unsetting some other variable leaves OLDPWD in place, which is why finding 1 wasn't caught.
   - **Line 126, `ln`:** I put back `real(resolve(cwd, operands.at(-1)!))` in place of `located(…)`. 0 tests fail.
   - **Line 157, linked folders:** I put back `real(resolve(dir, path))` inside `linkedFolders(…)`. 0 tests fail.

## Notes (not blocking)

- **Refactors keep behaviour.**
  - `theirs` and the edit/write loop now evaluate every path instead of stopping at the first refusal. The result is the same: `real` (job-place.ts:37) never throws, and `refusal` has no side effects and never returns `""`.
  - In `editPaths`, `?.slice(1, 2) ?? []` matches the old `named?.[1] === undefined ? [] : [named[1]]`, because both capture groups always match.
  - Every row of the base test is still there and passes.
- **Earlier work rechecked.**
  - The other 21 mutations, of the subshell restore, `cd -`, the bare-`pushd` swap, assignment alone, prefix and `export`, `unset`, empty assignment, the UNSET refusal, both shell-words expansions, `alone`, `~-` replacement, env OLDPWD, `git -C` and `popd`, are each caught by one failing test.
  - Inside `if`, `{ }`, `&&`, `bash -c`, `eval`, `$(…)`, `pushd -`, `cd -- -` and `pushd --`, my probe of the guard refused each one naming the main checkout.
- **Already true on the base commit:** a `cd` that fails still moves the guard's `cwd`. `cd <main>; cd /nonexistent; rm README.md` passes on base and on the branch. The new `cd -` variant after a failed `cd` comes from the same cause.
- Bash drops an OLDPWD from the environment that is not a directory: `OLDPWD=/nonexist bash -c 'echo [$OLDPWD]'` prints `[]`. The guard still uses that value as `previous`. I found no way to reach main through it.
- When OLDPWD is unset, `echo $OLDPWD` and `ls ~-` are refused too, which is broad but allowed by the ticket's "refused as unknown".

## Checks run

- `timeout 300 npm run check`: `tsc`, no errors.
- `timeout 300 node --test test/structure.test.ts`: 15 pass, 0 fail.
- `timeout 300 node --import @arthur/core/testing --test packages/core/test/worktree-guard.test.ts`: 11 pass, 0 fail.
- `wc -l`: `worktree-guard.ts` 200, `shell-words.ts` 200.
- A throwaway probe calling `worktreeRefusal` with a fake place, on the branch and on base `0fdb594c`, compared with real bash 5.2.21 (`env -u OLDPWD bash -c …`). This is the source of findings 1 and 2 and the failed-`cd` note.
- 25 mutations, each run against `worktree-guard`, `env-guard` and `env` tests and each restored afterwards. The harness moved this run to the background against the task's instruction; I waited in the foreground until it exited before going on.
- The checkout is clean and the throwaway files are deleted.
- I did not run `npm ci` or the full `npm test`, as the task said.

FAIL