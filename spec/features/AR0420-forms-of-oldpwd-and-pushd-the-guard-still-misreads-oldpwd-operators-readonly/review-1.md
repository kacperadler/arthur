# AR0420 - Review 1

- Job: 2026-10-25-review-6f6cdb39
- Branch: arthur/2026-10-25-worker-3e326757
- Commit reviewed: 6cc65063d239a0c2ea27ea77f877780050c3cab9
- Verdict: FAIL

## Final message

## Findings

1. **The branch reopens a deletion of the main checkout that the base refused.** At `packages/core/src/worktree-guard.ts:101`, `"local"` was dropped from the verbs that set OLDPWD, everywhere. The guard reads a function's body where the function is defined, so `local` inside a function is now ignored too. The command `f() { local OLDPWD=<main>; cd -; rm README.md; }; f` is refused at base `d3a42b44` (the main checkout is named) and passes at `6cc65063`. Real bash (`env -u OLDPWD bash -c …`) deletes the main checkout's `README.md` with it. The ticket's form 3 is "`local OLDPWD=x` *outside a function*", so dropping `local` inside one goes further than it asks. This form did not pass before the branch, so it is a regression, not a later-ticket note. The worker wrote it up as F1 in `findings.md` but marked it "[INFERENCE … not run]". I ran it: the refusal is gone and the deletion is real. It counts under "Something can lose the owner's work".
2. **Three mutations survive, and each opens a bypass real bash confirms.** I checked each command with the current code (it is refused) and with real bash (`README.md` deleted):
   - **`packages/core/src/shell-words.ts:93`:** adding `+` to the operators read as `~-` (`(:?[-=?]|$)` → `(:?[-=?+]|$)`) fails no test. With that change, `cd /tmp; cd ${OLDPWD:+<main>} && rm README.md` passes; I checked this one with the mutation in place. The code deliberately treats `+` apart from the other operators ("another operator but `+`"), and no row pins it.
   - **`worktree-guard.ts:103`:** removing `command.alone &&` from the read-only check fails no test. A `readonly OLDPWD | true` in a pipeline would then mark OLDPWD read-only. That lets `cd /tmp; readonly OLDPWD | true; cd <main>; cd /var; cd -; rm README.md` through [INFERENCE: traced from the code, not run with the mutation in place].
   - **`worktree-guard.ts:103`:** widening `/^OLDPWD(?!\w)/` to `/^OLDPWD/` fails no test. `readonly OLDPWDX` would then mark OLDPWD read-only, letting `readonly OLDPWDX; cd <main>; cd /tmp; cd -; rm README.md` through [INFERENCE: traced from the code, not run with the mutation in place]. The only nearby row, `readonly FOO=1`, uses a different name.

## Notes

- **Mutation, safe side:** dropping `(\[0\])?` at `shell-words.ts:93` survives. `${OLDPWD[0]}` would then be refused as unknown instead of followed, so nothing gets through.
- **Mutation, narrow:** `literal(set[2]!)` → `set[2]!` at `worktree-guard.ts:101` survives. It matters only when an OLDPWD value has a quoted special character (`\ * ? [ ] { } , ( )`).
- **F2 (`pushd -n -`, `declare -n OLDPWD`):** both pass at base and at the branch, so they belong to a later ticket. `function f { local OLDPWD=…; }; f` also passes at base.
- **The six forms:** every row the ticket names is refused naming the main checkout, and each fails when its fix is removed. I also checked by hand: `${OLDPWD-x}`, `${OLDPWD=x}`, `${OLDPWD:=x}`, `"${OLDPWD:-x}"`, `${OLDPWD#x}`, `${OLDPWD/x/y}`, `${OLDPWD^^}`, `${OLDPWD[@]}`, `${!OLDPWD}`, `OLDPWD=(a x)`, `declare -a OLDPWD=(…)`, `OLDPWD[00]=`, `typeset -r`, `declare -gr`, `readonly -a OLDPWD=(…)`, `readonly OLDPWD=x FOO`, `readonly -p OLDPWD`, `pushd -n dir` after a `pushd`, and lists with spaces, quotes, a newline and a comment. All are refused or followed as bash runs them.
- **Outside the ticket's Scope:** the extra `env-guard.test.ts` row and the `find` roots rewrite (`worktree-guard.ts:139`) keep behavior identical; the rewrite was made to stay within 200 lines.

## Checks

- `npm ci`: 22 packages added.
- `npm run check`: tsc passes.
- `timeout 900 npm test`: 1108 tests, 1050 pass, 0 fail, exit 0.
- `node --import @arthur/core/testing --test packages/core/test/worktree-guard.test.ts packages/core/test/env-guard.test.ts`: 14 tests, 14 pass, matching the worker's claim.
- `wc -l`: `worktree-guard.ts` and `shell-words.ts` are 200 lines each; the source diff is +43/−43.
- **Mutation sweep (31 mutations):** 26 caught. They cover the operator set and the `\0` marker, every part of the read-only handling (set, unset, `cd`, subshell, child shell, `-f`, `declare -r`), `local`, both `pushd -n` and `popd -n`, the eval `+=` restore, the `[0]` and `=(` forms, list parsing, `commandIndex`, the unset index, all four parts of the unknown-form refusal, and `SPECIAL` with `()`. The five survivors are listed above. The tree is clean afterwards (`git status --short` is empty).
- **Base vs branch and real bash:** I ran the guard at base (from `git archive d3a42b44`) and at the branch on the same commands, and ran each command with real `env -u OLDPWD bash -c …` in a scratch folder, since removed. This is how finding 1 and the bypasses for findings 2a–2c were confirmed.

FAIL