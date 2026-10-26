# AR0335 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A git binary called by its own path, or GIT_CONFIG_* exported before the call, passes the guard

- Kind: security
- Found by: reviews 2 and 3 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/core/src/git-writes.ts`
- What: `/usr/lib/git-core/git-gc --prune=now`, `git-reflog expire`, `git-worktree prune`, and `export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=gc.pruneExpire ...` before a commit are not seen.
- Status: dropped (AR-D53: a deliberate evasion, not a mistake; the guard catches mistakes and the sandbox is the bound, AR-D46)

## F2. Other maintenance commands pass

- Kind: security
- Found by: review 1 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/core/src/git-writes.ts`
- What: `git pack-refs --all --prune`, `multi-pack-index expire`/`repack`, `commit-graph write`, `worktree repair /tmp/x` are not refused.
- Status: dropped (AR-D53: none deletes an object a job's work needs; the ticket does not list them)

## F3. Option values of worktree add are judged as paths

- Kind: fix
- Found by: review 4 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/core/src/git-writes.ts:72`
- What: `-b topic` from an outside folder is refused as a target.
- Status: dropped (stricter than needed; opens no hole)

## F4. Two mutations of the adds check survive

- Kind: test
- Found by: review 1 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/core/src/git-writes.ts`
- What: `place.worktrees` to `place.worktree` changes nothing; another job's worktree is refused already.
- Status: dropped (neither weakens the refusal)

## F5. One long comment line

- Kind: refactor
- Found by: review 4 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/core/src/worktree-guard.ts:70`
- What: the folded comment has one long line.
- Status: dropped (style only)
