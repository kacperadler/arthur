# AR0333 - Review 4

- Job: 2026-10-25-review-7e795c1f
- Branch: arthur/2026-10-25-worker-9a6298d8
- Commit reviewed: 831b31f4654f7d9e9277146a15705005b12ec25f
- Verdict: FAIL

## Final message

**Review of AR0333, round 4: FAIL.** `npm ci`, `npm run check` and `npm test` all pass, but two problems block the merge. Array assignments of OLDPWD get past the guard, and one mutation of a key behavior survives the tests.

## Findings

1. **`packages/core/src/worktree-guard.ts:99`: array assignments of OLDPWD are not followed, so `cd -` lets a write into the main checkout through.** The regex `/^OLDPWD(\+?)=/` only matches the scalar form. The ticket's Done means says "an assignment of `OLDPWD` sets it", and these three are not in the AR0420 Out list. I ran each through `worktreeRefusal` with OLDPWD unset and a made-up main checkout; all three passed:
   - `cd /tmp; cd /var; OLDPWD[0]=<main>; cd -; rm README.md`
   - `cd /tmp; OLDPWD=(<main>); cd -; rm README.md`. `shellCommands` reads the `(` as a subshell, so the guard sets OLDPWD to `""` and `cd -` stays put.
   - `cd /tmp; declare OLDPWD[0]=<main>; cd -; rm README.md`

   Real bash 5.2 (`env -u OLDPWD bash -c …`) goes to `<main>` for both `OLDPWD[0]=` and `OLDPWD=(…)`. Running the `OLDPWD[0]=` form deleted a file in the made-up main checkout. In bash, `OLDPWD[0]` is the same value as `$OLDPWD`.

2. **`packages/core/src/worktree-guard.ts:100`: a surviving mutation.** I removed `command.alone &&` from the `unset` line, and the guard test still passed (11 pass, 0 fail). That check is what stops `unset` from looking like a bypass:
   - In `cd <main>; cd /tmp; unset OLDPWD | true; cd -; rm README.md`, bash runs the piped `unset` in a subshell, so its own OLDPWD stays `<main>` and `cd -` goes there.
   - With the mutation, the guard thinks OLDPWD is unset, `cd -` stays in `/tmp`, and the `rm` passes.

   The `bash -c` and `eval` code got a pipeline test row, but the piped `unset` has none.

## Notes (not blocking)

- **More ways past the guard I found, besides those above.** None is in the ticket's Done means. The 2nd and 3rd are the same kind as findings.md F2, which only names `env -u`/`env -i`, so they could be added there:
  - `cd <main>; cd /tmp; eval 'cd /var' | cat; cd -; rm README.md` passes. An `eval` in a pipeline is not treated as a subshell, so its `cd` seems to stay in effect. The same thing happens for the folder alone (`cd <main>; eval 'cd /tmp' | cat; rm README.md` passes), and that part is older than this branch.
  - `cd /var; cd <main>; export -n OLDPWD; bash -c 'cd -; rm README.md'` passes. The inner bash gets no OLDPWD (confirmed in real bash: "cd: OLDPWD not set"), so it stays in main, while the guard sends the inner `cd -` to `/var`.
  - The same happens with `env -u OLDPWD bash -c …`, which F2 already records.
- **Refactors to stay at 200 lines.** `editPaths`, the edit/write path loop, `theirs` and the `find -exec` loop were turned into `.map(…).find(Boolean)`; the final message gives the reason. The result is the same, because every side effect of `run` after the first refusal is thrown away.
- **The worker's final message matches what I saw:** 11 pass in the guard test, `tsc` clean, both files at 200 lines, four commits, F1 and F2 open.

## Checks I ran

- `npm ci`: added 22 packages.
- `npm run check`: `tsc` reported no errors.
- `timeout 900 npm test`: 1106 tests; 1048 pass, 0 fail, 58 skipped.
- `wc -l`: `worktree-guard.ts` 200, `shell-words.ts` 200.
- `node --test packages/core/test/worktree-guard.test.ts`: 11 pass, 0 fail.
- **Real bash 5.2.21 checks:**
  - `OLDPWD=/var eval "cd /etc"` puts the old OLDPWD back and keeps `/etc` as the folder, as the worker said.
  - OLDPWD is exported once `cd` sets it.
  - `OLDPWD[0]=X` and `OLDPWD=(X)` both make `cd -` go to X.
  - A piped `eval 'cd …'` does not last.
  - After `export -n OLDPWD`, a child bash has no OLDPWD.
- **A throwaway script that ran 31 commands through `worktreeRefusal`, deleted afterwards.**
  - These were refused correctly: `cd -- -`, `cd -L -`, `pushd -`, `{ cd -; }`, `if … then cd -; fi`, `&&` chains, `$(cd …)`, a background `cd`, `builtin`/`command`/`readonly`/`export` assignments, `"$OLDPWD"/…`, `${OLDPWD}/…`, `cp x ~-`, and prefixes before `sh -c`, `sudo bash -c`, `timeout 5 bash -c` and `env … sh <<EOF`.
  - `OLDPWD=/var eval 'cd -'` passed, which matches bash.
  - The array forms, piped `eval` and `export -n` cases above passed, which is wrong.
- **28 mutations against the guard test, each restored with `git checkout --`.** 27 failed the test as they should, covering:
  - the `eval` restore, `unset -f`, any-name `unset`, the empty-or-unset refusal and its redirect part;
  - `+=`, the subshell restoring the previous folder and the `pushd` stack;
  - the `alone`, `cd` and `at < 0` gates and `export` on the assignment line;
  - `~-` in an assigned value, `cd -` going home, the bare `pushd` swap, `cd` setting the previous folder, the stay-put with nowhere to go, the OLDPWD taken from the env;
  - the shell prefix moved outside the parentheses;
  - `~-` read in paths, git `-C`, `ln` and linked folders;
  - `+=` in `commandIndex`, and `$OLDPWD` and `${OLDPWD}` in `shell-words.ts`.

  Only the `unset` `alone` mutation survived (finding 2).
- `git status --short` was empty after the mutations were restored.

FAIL