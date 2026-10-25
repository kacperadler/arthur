# AR0372 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

## F1. The patch can be committed by mistake, and `git diff` leaves staged changes out

- Kind: fix
- Found by: 2026-10-25-review-7e3c6c08 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/core/src/worktree-guard.ts:31`, `.gitignore`
- What: A `git add -A` stages `.arthur-stash.patch`; `git diff` saves only unstaged changes, `git diff HEAD` would save both.
- Status: ticket AR0414

## F2. Run from a subdirectory, the patch lands there and `git apply` ignores paths outside it

- Kind: docs
- Found by: 2026-10-25-review-7e3c6c08 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/core/src/worktree-guard.ts:31`
- What: The old `/tmp` advice had the same limit.
- Status: dropped (the path stays inside the worktree; AR0414 rewrites the advice)
