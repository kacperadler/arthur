# AR0023 - Review 1

- Job: 2026-10-16-review-ar0023-worktree-g-84e0ca0c
- Branch: h/2026-10-16-ar0023-worktree-guard-a197f8a5
- Commit reviewed: 90dd02f53917dfd02f4f544af2f1c215986660ef
- Verdict: FAIL

## Final message

## Findings

**`packages/core/src/worktree-guard.ts:29` (`GIT_WRITES`) — `git fetch`, `git tag`, and `git branch` (create or delete of a branch not checked out anywhere) write into a guarded place without being refused.** `GIT_WRITES` lists only tree/index-oriented subcommands (`commit`, `checkout`, `reset`, `add`, `pull`, …) but omits `fetch`, `tag`, and `branch`. All three are plain, fully static git subcommands — no obfuscation, no runtime-only path — yet they write refs into whatever repository `-C`/`--git-dir`/`--work-tree` points at, which is exactly the class of "git writes aimed at a guarded place" the guard's own doc comment claims to cover ("Git subcommands that write a tree, the index or a ref of the checkout they run in"). Verified against real Git and against the branch's own `worktreeRefusal`:
- `git -C <main-checkout> fetch` creates `.git/refs/remotes/origin/<name>` and `.git/FETCH_HEAD` in the main checkout (confirmed with a real bare+clone setup) — `worktreeRefusal` returns `PASS`.
- `git -C <main-checkout> tag newtag` creates `.git/refs/tags/newtag` (confirmed the tag exists afterward) — `PASS`.
- `git -C <main-checkout> branch -D <branch-not-checked-out-anywhere>` deletes a ref file; only when the target branch happens to be checked out does *Git itself* refuse it (confirmed: `branch -D`/`branch -f` on the checked-out branch fails with Git's own "used by worktree" error) — but a branch with no live checkout (e.g. a stale one, or a name a future job will use) deletes cleanly — `PASS`.
- `git -C <main-checkout> branch newbranch` likewise creates a ref unblocked — `PASS`.

The worker's final message claims coverage of "`git` writes aimed at a guarded place (`-C`, `--work-tree`, `git worktree`)" and separately discloses only `git config` as an accepted gap ("Not caught, by design: … `git config`"). It does not disclose `fetch`/`tag`/`branch`, and the given rationale for the disclosed gaps ("the guard reads the command text, not what runs") doesn't actually apply here — these are static commands the parser already resolves correctly (`-C`'s target, the subcommand name); they were simply left out of `GIT_WRITES`. No test in `worktree-guard.test.ts` exercises `fetch`, `tag`, or `branch` at all (`grep` for these terms in the test file: no matches), so the gap has zero coverage, not merely weak coverage.

This directly contradicts roadmap entry 20's Delivers line ("a file tool or bash command that writes into the main checkout … is refused: … `git` writes …") for a security-sensitive guard whose entire purpose is this boundary. A job can pollute or corrupt the main checkout's refs/remote-tracking state or delete a stale branch out from under the human, unrefused.

Mutation check on what *is* implemented: removing `"commit"` (and letting `checkout` stand in) from `GIT_WRITES` makes the existing test fail exactly as expected (`git -C ../../acme commit -m x` → expected `'the main checkout'`, got `undefined`), so the covered subset is genuinely tested; the bug is a scope omission, not a weak assertion.

## Notes

- Everything else probed held up well: redirects (including `>()`, `exec N>path`, multiple redirects), writing commands (`rm`, `mv`, `sed -i`, `perl -i`, `cp`/`install --target-directory`, `rsync`, `ln -s`/`-sf`, `dd of=`, `find -delete`/`-exec`), `cd`/`pushd` persistence across `;`/`&&`/newlines but not across pipelines/subshells, `bash -c`, `eval`, heredocs/here-strings with nested `$(…)`, symlinks (existing, dangling, folder-vs-file), `~`/`$HOME`, `git stash` (all but `list`/`show`), `git worktree add/remove`, and the explicitly-disclosed dynamic-content gaps (`$VAR`, `$(cmd)` building a path from an assigned variable, `xargs`, `node -e`, `printf | bash`) all behaved exactly as documented — no false refusals on `npm test`, `npm ci`, `git add/commit/push`, `git log/diff/status`, nested `cd`.
- Env guard: the shared-parser refactor does not weaken it — `.env` inside a shell comment is still caught via the raw-text `namedFile` check run before `shellWords` splitting (verified with a literal case avoiding the live session's own env-guard interception); the full `env-guard.test.ts` suite (3/3) still passes.
- F1 (cross-project risk) is honestly recorded in `findings.md` as `open`, consistent with the worker's message.
- Line budgets: `shell-words.ts` and `worktree-guard.ts` are each exactly 200 lines; `wrapper.ts` 199; `jobs.ts` untouched at 200 (confirmed no diff touches it). Core-package line-budget structure test (4000, in untouched `test/structure.test.ts`) passes.

## Checks run

- `npm ci` — clean (5 packages, no lockfile change).
- `npm run check` — clean, no TS errors.
- `npm test` — 227/227 pass, matching the worker's claim exactly.
- `npx node --test packages/core/test/env-guard.test.ts` — 3/3 pass.
- Mutation: removed `"commit"` from `GIT_WRITES` → `worktree-guard.test.ts` fails as expected; restored, confirmed clean via `git status --short`.
- ~25 hand-written bypass probes against `worktreeRefusal`/`bashRefusal` directly (quoting, symlinks, `cd`/pushd, heredocs, `git -C`/`--git-dir`, `find -exec`, process substitution, variable/command-substitution dynamic paths, common worker commands) via a throwaway script — all behaved as documented except the `git fetch`/`tag`/`branch` gap above.
- Verified with real Git (temp repo + worktree) that Git itself blocks `branch -D`/`-f` only on a checked-out branch, and that `fetch`/`tag`/`branch` on a non-checked-out target genuinely write ref files, confirming the gap is real and exploitable, not just a theoretical reading of the code.
- Cleaned up all throwaway files/dirs (`/tmp/wtg-probe`, `/tmp/gitcheck*`, `/tmp/envsmoke.mjs`); worktree is clean (`git status --short` empty).

FAIL
