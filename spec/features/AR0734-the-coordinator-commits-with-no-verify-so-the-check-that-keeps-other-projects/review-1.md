# AR0734 - Review 1

- Job: 2026-11-24-review-54683418
- Branch: arthur/2026-11-24-worker-3bbca2dc
- Commit reviewed: 9b7e3b64e03c68f8daa4b96cdf24697b625695ce
- Verdict: PASS

## Final message

I found nothing that blocks the merge. Every point of the ticket's "Done means" is met:

- **Role lines:** `packages/orchestration/roles/coordinator.md:35` and `packages/orchestration/roles/project.md:30` each gain the same sentence, right after "Commit `spec/decisions.jsonl` with the board.": "Never commit, this file or anything else, with `--no-verify` (`-n`) or with hooks turned off (`core.hooksPath`): a commit a hook refuses is reworded, never forced." `git diff --word-diff=porcelain` shows that sentence as the only change in each file.
- **New planning ticket:** AR0738 is on main (8503e1db, planned and approved as AR-D725). It names AR0667's `plan.md` lines 41 to 48 (AR-D594) as its source, and the worker's final message gives its id. A worker cannot add the ticket on its own branch (`paper-check.ts`), and the worker says so in F1.
- **History question:** the final message raises whether to rewrite 34d2eb9a and cites AR-D711; nothing was rewritten.
- **Scope:** no source file changed and nothing outside the Scope's In changed, apart from the ticket's own `findings.md`. Nothing in the docs contradicts the new rule: `worker.md:44` already says the same, and `commit-rules.md:34` is about jobs.

## Notes
- (minor) spec/features/AR0734-the-coordinator-commits-with-no-verify-so-the-check-that-keeps-other-projects/findings.md:11: F1 still says "T2 is still without a ticket", but AR0738 now exists on main. The merge should settle F1 as `ticket AR0738`, not open a second ticket for it.
- (minor) packages/orchestration/roles/project.md:30: the sentence names `-n` and `core.hooksPath`, but not other ways a commit lands with no hook: a `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_*` environment setting `core.hooksPath`, or `git commit-tree` with `git update-ref`. "Hooks turned off" covers the first in spirit. AR0738's command is the real fix (adds to F3).

## Checks (on 9b7e3b64, clean tree)
- `npm run check`: `tsc` clean. I ran it chained with `npm test` and a filter whose pattern did not match the test output, so that call exited 1, but `tsc` printed nothing.
- `npm test`, rerun alone: exit 0; tests 1924, pass 1860, fail 0, skipped 64. This matches the worker's numbers.
- `npm run mutate`: `mutate: 0 mutants, 0 caught, 0 survived` (no source file in the range).
- `git diff --word-diff=porcelain 130acd90..9b7e3b64 -- packages/orchestration/roles`: two added lines, the same sentence in each file, nothing removed.
- `git show 8503e1db:spec/features/AR0738-…/ticket.md`: the ticket exists and names the plan as its source.
- `git status --short | wc -l` after the checks: 0.

PASS