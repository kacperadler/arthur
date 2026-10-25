# AR0420 - Review 2

- Job: 2026-10-25-review-a6634d65
- Branch: arthur/2026-10-25-worker-3e326757
- Commit reviewed: f304a31200e7424c224e0b33fdb4f2b4fc3c0f33
- Verdict: FAIL

## Final message

## Findings

1. **`packages/core/src/worktree-guard.ts:92`: a quoted or escaped `}` reopens review 1's finding 1.** The `{`/`}` count uses `literal(word)`, so the escaped `\}` and the quoted `"}"` each lower `depth`. To bash these are plain commands that fail with "not found", and the script goes on. If `depth` drops below zero, a function body's `{` only brings it back to 0, and `local OLDPWD=` inside the body is ignored again. I ran each command three ways: the guard at base `d3a42b44`, the guard at this branch, and real `env -u OLDPWD bash -c …` in a scratch folder.
   - `\}; f() { local OLDPWD=<main>; cd -; rm README.md; }; f`: base refuses it (names the main checkout), the branch passes it, bash deletes main's `README.md`.
   - `"}"; f() { …same… }; f`: base refuses, branch passes, bash deletes it.
   - `true || \}; f() { …same… }; f`: base refuses, branch passes, bash deletes it.

   Each of these was refused before the branch and passes now, so each is a regression.
2. **`worktree-guard.ts:101`: `local` in a function body that is not `{ }` or `( )` is no longer followed.** `local` now counts only when `depth > 0 || subshells.length > 0`. Bash also accepts a function whose body is `if`, `for`, `while`, `until` or `case`.
   - `f() if true; then local OLDPWD=<main>; cd -; rm README.md; fi; f`: base refuses, branch passes, bash deletes it.
   - `f() for x in 1; do local OLDPWD=<main>; cd -; rm README.md; done; f`: base refuses, branch passes, bash deletes it.
   - `f() while true; do …; break; done; f`: base refuses, branch passes, bash deletes it.
   - `f() until false; do …; break; done; f`: base refuses, branch passes, bash deletes it.
   - `f() case x in x) local OLDPWD=<main>; cd -; rm README.md;; esac; f`: base refuses, branch passes, bash deletes it.

   Again, each was refused before and passes now. F1's own suggestion would close both findings 1 and 2 without tracking depth: refuse as unknown any `local OLDPWD` that is not at the top level.
3. **`worktree-guard.ts:92`: one mutation survives.** I removed the `}` decrement (`word === "}" ? -1 : 0` → `0`) and no test failed (`ℹ fail 0`). With that mutation, `f() { :; }; cd <main>; cd /tmp; local OLDPWD=/tmp; cd -; rm README.md` passes the guard and real bash deletes main's `README.md`. Unmutated, the guard refuses it. No row defines a function before a top-level `local`.

## Notes

- **`local` at the top level inside a group.** `cd <main>; cd /tmp; { local OLDPWD=/tmp; }; cd -; rm README.md` and `cd <main>; cd /tmp; \{; local OLDPWD=/tmp; cd -; rm README.md` both pass at base and at the branch, and bash deletes `README.md` with both. The worker named the `{ }` group case as known. Both are variants of form 3 for a later ticket, unless the fix for finding 1 covers them.
- **Other forms that passed before too.** `function f { local OLDPWD=…; }; f` passes at base and at the branch. F2 (`declare -n OLDPWD`, `pushd -n -`) is still open in `findings.md`.
- **The ticket's example commands are all handled.** Each one, plus `f() ( local … ); f`, is refused naming the main checkout. Real bash deletes main's `README.md` with every one of them.
- **Review 1's three mutations are now caught:** `+` read as `~-`, `command.alone` dropped from the read-only check, and `(?!\w)` dropped.

## Checks

- `npm ci`: 22 packages added.
- `npm run check`: tsc passes.
- `timeout 900 npm test`: 1108 tests, 1050 pass, 0 fail, 0 cancelled, exit 0.
- `node --import @arthur/core/testing --test packages/core/test/worktree-guard.test.ts packages/core/test/env-guard.test.ts`: 14 tests, 14 pass. This matches the worker's claim.
- `wc -l`: `worktree-guard.ts` and `shell-words.ts` are 200 lines each.
- **Mutations, run against `worktree-guard.test.ts`:**
  - `depth` count turned off: caught.
  - `local` followed everywhere: caught.
  - `local` followed only when `depth > 0`: caught.
  - `local` followed only in subshells: caught.
  - `}` decrement removed: **survives** (finding 3).
  - Review 1's three mutations: all caught.

  The tree was clean afterwards (`git status --short` empty).
- **Base against branch against real bash:** I extracted base `d3a42b44`'s `packages/core/src` with `git archive` and ran a throwaway script in `/tmp`, since removed. It ran each command through both guards and through `env -u OLDPWD bash -c` in a scratch folder. That run produced every finding above and confirmed the ticket's example commands.

FAIL