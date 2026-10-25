# AR0372 - Review 1

- Job: 2026-10-25-review-7e3c6c08
- Branch: arthur/2026-10-25-worker-eee3020e
- Commit reviewed: f7c9affe87f8baee5d8988061dc022f0d3842fe4
- Verdict: PASS

## Final message

No finding blocks the merge. The refusal now tells a job to save its patch at `.arthur-stash.patch` in its own worktree, and the test compares the whole refusal text, which is what the ticket's Done means asks for.

## Findings

None.

## Notes

- **Committed by mistake (`git add -A`).** It can happen. The repository's `.gitignore` holds only `.h/`, `.env`, `node_modules/`, `arthur.config.ts` and `.arthur/`, so a `git add -A` or `git add .` would stage `.arthur-stash.patch` and commit it. No role prompt under `.agents/` and nothing in `packages/core/src` runs `git add` itself, so it would be the job's own choice. The ticket accepts this risk ("which the job's `.gitignore` or a `git add` decides") and names `$(mktemp)` as the alternative. The file only holds the job's own diff, so a stray commit leaks nothing new: it is a junk file a review would see in the diff. If the owner wants it closed for Arthur's own repository, a one-line `.arthur-stash.patch` entry in `.gitignore` would do it; that is not in this ticket's scope.
- **Is the advice safe.** It is safer than before: the path is the job's own, so another job's stale patch can no longer reach `git apply`. Three limits remain, and the old `/tmp` advice had the same ones:
  - `git diff` saves only unstaged changes to tracked files. Staged changes and untracked files are left out, while `git stash` keeps staged changes. `git diff HEAD` would capture both tracked kinds.
  - The path is relative to the current folder, so run from a subdirectory the patch lands there. It is still inside the worktree, which the guard passes.
  - `git apply` run from a subdirectory ignores paths outside it.
- **Worker's claims match.** Two files changed at `worktree-guard.ts:31` and `worktree-guard.test.ts:83-84,201,215`, with one commit `f7c9affe` whose scope is AR0372. The source line count is unchanged. The test now accepts the stash refusal only when it is the exact text (`reason === STASH`); any other text falls through to the `writes into` regex and fails the `git stash` and `git stash pop` rows. The new allowed row checks that the guard lets the advice through.
- **Not checked by me.** The worker's break test (putting the `/tmp` text back makes the guard test fail): you limited me to three commands, so I ran no mutations. I did not run the full `npm test` either; you said the merge runs it on main.
- **Out of range.** The old `/tmp/<name>.patch` text remains in AR0327's `check.md`/`findings.md` and in this ticket's Evidence, as records of what was found.

## Checks run

- `npm run check`: `tsc` ran with no errors.
- `timeout 300 node --test test/structure.test.ts`: pass 15, fail 0, line budget test included.
- `timeout 300 node --import @arthur/core/testing --test packages/core/test/worktree-guard.test.ts`: pass 11, fail 0.

PASS