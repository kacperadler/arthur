# AR0493 - Review 1

- Job: 2026-10-28-review-66038e1b
- Branch: arthur/2026-10-28-worker-86ff30bd
- Commit reviewed: d37fa4a879244b72d944236acfae57ee16f24760
- Verdict: FAIL

## Final message

I'm failing this branch. It opens a new bypass: two commands that delete the main checkout's README are refused on the base and pass on the branch.

## Findings

1. **`packages/core/src/shell-join.ts:43-44` with `packages/core/src/shell-words.ts:151,159`: a security regression, and the first Done means point is not met.**
   - **Cause in `joinLines`:** it does not track a `${…}` inside double quotes. An inner `"` in `"${x:-"…"}"` closes the outer quotes (line 44). A later `'` is then read as an opening single quote, so no backslash-newline is removed until the next `'`.
   - **Why the old safety net is gone:** the branch also removed the backslash-newline handling from `shellCommands` (lines 151 and 159). A backslash-newline that `joinLines` misses now goes into the word as a newline.
   - **Proof:** I ran `worktreeRefusal` on a temporary `Place` whose `root` is `../../acme` from the worktree:
     - `rm "${x:-"'"}" ../../ac\<newline>me/README.md`: refused as main checkout on base `48b4051`, **passes** on `d37fa4a`.
     - `rm "${x:-"'"}" \<newline>../../acme/README.md`: refused on base, **passes** on the branch.
     - bash 5.2 reads `../../acme/README.md` for the first one (`printf '[%s]'` via `env -i bash`).
   - **Still missed:** `rm "${x:-"a'b"}" $\<newline>HOME/acme/README.md 'c'` passes on both base and branch. bash prints `/h/acme/README.md` for it with `HOME=/h`. So the parser still does not remove a backslash-newline "wherever bash does".

2. **`packages/core/src/shell-join.ts:42`: a mutation the tests do not catch.** If I replace `if (char === "`") within.pop();` with `{}`, so a backtick never closes, all of `worktree-guard.test.ts` still passes. The mutation does change behaviour: for `` echo `x`; rm '\<newline>'/../../../acme/README.md `` it removes the backslash-newline inside the single quotes, which bash keeps. No test row has a single-quoted backslash-newline after a closed backtick.

## Notes (not blocking)

- **Changed test row:** the worker replaced the ticket's `$\<newline>HOME/../acme/README.md` with `$\<newline>HOME/acme/README.md`. The reason holds: the test sets `HOME` to `dirname(root)` (`worktree-guard.test.ts:493`), so `$HOME/../acme` is not the main checkout.
- **Budget raise:** the core budget goes from 6414 to 6485. The ticket's Decisions already allow it (2026-10-28, AR-D63), even though the worker's message says it is not recorded there.
- **F1 in `findings.md`:** I ran it through the guard. `((x<<1))\nrm ../../acme/README.md` passes on both base and branch, so it was there before this change.
- `shell-words.ts` is at exactly 200 lines and `shell-join.ts` has 72. No new import crosses a package boundary.

## Checks run

- **`npm ci`:** exit 0.
- **`npm run check`:** tsc exit 0.
- **`npm test`, first run:** 1 fail. The `merge.test.ts:593` timing test hit ENOENT on its `pid` file. That run overlapped with my second run.
- **`npm test`, second run:** tests 1229, pass 1168, fail 0, skipped 61, exit 0. This matches the worker's numbers.
- **Mutations of `shell-join.ts`,** each run against `worktree-guard.test.ts` and then restored with `git checkout`. Nine were caught:
  - no skip of a backslash-newline after `$`
  - no top-level join
  - no single-quote branch
  - quoted heredoc body joined
  - no `<<-` tab strip
  - no comment branch
  - no heredoc drop when a `$(…)` closes
  - no `$'…'` branch
  - no double-quote push
  
  One survived: a backtick never closing (finding 2).
- **Guard probes:** I ran every command above on both the base and the branch.
- **Cleanup:** I deleted every temporary file. `git status` shows a clean tree.

FAIL