# AR0420 - Review 3

- Job: 2026-10-25-review-723f86d7
- Branch: arthur/2026-10-25-worker-3e326757
- Commit reviewed: bd0f646709904e7dd98c0ca0d7d3d12a31336cae
- Verdict: FAIL

## Final message

The AR-D21 code is correct. It fails review on two mutations the tests don't catch. Each one, if applied, lets a command through that the base guard refused and that real bash uses to delete the main checkout's `README.md`.

## Findings

1. **`packages/core/src/worktree-guard.ts:109`: no test covers `pushd -` while OLDPWD is unknown.**
   - Mutation: `if (dir === "-" && …)` → `if (verb === "cd" && dir === "-" && …)`. `worktree-guard.test.ts` still passes (`fail 0`).
   - With that mutation the guard passes `f() { local OLDPWD=<main>; pushd -; rm README.md; }; f`, which the base `d3a42b44` refused naming the main checkout. It also passes `cd <main>; cd /tmp; local OLDPWD=/tmp; pushd -; rm README.md`. Real `env -u OLDPWD bash -c` deletes main's `README.md` with both.
   - The worker's message says "`cd -` and `pushd -` are refused", but every `local` row in the tests uses `cd -`. The `pushd -` half is only claimed, not tested.

2. **`worktree-guard.ts:101`: no test covers `local` with OLDPWD anywhere but its first argument.**
   - Mutation: `args.some((word) => /^OLDPWD(?!\w)/.test(word))` → `/^OLDPWD(?!\w)/.test(args[0] ?? "")`. `worktree-guard.test.ts` still passes (`fail 0`).
   - With that mutation the guard passes three commands: `f() { local x=1 OLDPWD=<main>; cd -; rm README.md; }; f`, `f() { local -r OLDPWD=<main>; …}; f` and `f() { local -- OLDPWD=<main>; …}; f`. The base refused all three naming the main checkout, and bash deletes main's `README.md` with each.
   - AR-D21 says any `local` naming OLDPWD makes it unknown, but every `local` row puts OLDPWD first.

## Notes (not blocking)

- **`function f { local OLDPWD=<main>; cd -; rm README.md; }; f`** passes at the base and on this branch, and bash deletes `README.md`. The guard's verb for that command is `function`, so it never sees the `local`. This form isn't in the ticket, so it belongs to a later ticket. `function f() { … }` is refused.
- **`declare`/`typeset` inside a function act as `local` in bash**, but the guard follows them as plain assignments wherever it reads the function's body. This was the same before the branch; it falls in the out-of-scope functions ticket.
- **Mutation "the `local` check only for a command outside a pipeline"** (`if (command.alone && verb === "local" …)`) also survives. It isn't a finding: in bash a `local` in a pipeline or in the background runs in a subshell and doesn't last.
- **The round-3 change itself** (`f304a312..af1f4838`) is small. It removes the `{`/`}` counting, adds one `local` line, adds the `cd -`/`pushd -` refusal, and widens the `~-` check. The AR-D21 rule is applied as decided.
- **All six forms are handled.** Each of the ticket's example commands is refused, while real bash deletes main's `README.md` with each. So are form 3 and review 2's eight F1 commands. None of the commands I tried was refused before this branch and passes now.
- **F2** (`declare -n OLDPWD`, `pushd -n -`) is still `open` in `findings.md`, as the worker says.
- **The first full `npm test` run had 1 failure**, out of 1108 tests. My output filter hid which test failed. An unfiltered rerun passed, so it looks flaky, but I don't know which test it was.

## Checks run

- `npm ci`: 22 packages added.
- `npm run check`: tsc passes.
- `wc -l`: `worktree-guard.ts` and `shell-words.ts` are 200 lines each.
- `timeout 900 npm test`:
  - first run: `fail 1`, failing test name not captured;
  - rerun: 1108 tests, 1050 pass, 0 fail, 0 cancelled, 58 skipped.
- `node --import @arthur/core/testing --test packages/core/test/worktree-guard.test.ts packages/core/test/env-guard.test.ts`: 14 tests, 14 pass. This matches the worker's claim.
- `node --test test/structure.test.ts`: 16 tests, 16 pass. This matches the worker's claim.
- **Three-way comparison:** a throwaway script in `/tmp/ar0420-r3`, since removed, ran each command three ways:
  - through the base guard (`git archive d3a42b44`);
  - through this branch's guard;
  - through real `env -u OLDPWD bash -c` in a scratch repository.

  I ran about 60 commands this way: the ticket's six forms, form 3 and review 2's commands, and a set of `local`, `pushd` and `$OLDPWD` variants.
- **Mutations, run against `worktree-guard.test.ts`, each file restored afterwards:**
  - `local` line removed: caught.
  - `(?!\w)` dropped from the `local` check: caught.
  - `cd -` unknown refusal removed: caught.
  - `~-` check reverted to `!previous`: caught.
  - `local` checked on its first argument only: **survives** (finding 2).
  - refusal of `-` limited to `cd`: **survives** (finding 1).
  - `local` checked only outside a pipeline: survives, but matches bash (see notes).

  After the mutations `git status --short` was empty.

FAIL