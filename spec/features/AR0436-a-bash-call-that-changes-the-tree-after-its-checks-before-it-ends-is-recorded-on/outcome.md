# AR0436 - Outcome

- Merged: 2026-10-27, `05e0d6e2`
- Branch: arthur/2026-10-27-worker-00956170
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $4.53, reviews n/a; review rounds 3

## What went in

- `packages/delivery/src/checks-extension.ts`: a checks line is `clean` only when the bash call began and ended on the same tree: the worktree is read at the call's start (keyed by its call id) and at its end (HEAD, `git status`, the index tags, and an `lstat` of every tracked file with its ctime), and any difference, an `assume-unchanged` or `skip-worktree` file, or a start never seen makes it `dirty`, naming the commit it began on. Its git calls run without replacements, hooks or fsmonitor.
- `packages/delivery/test/checks.test.ts`: `npm test; git stash`, an older tree tested and put back, a change after the run and one undone, two calls ending out of order, a file put back with its old mtime.
- Workers see one change: `npm test && git commit` in one call now records `<old commit> dirty`, so checks must run again after the commit. `test/structure.test.ts`: delivery's line budget is 1552 (AR-D123).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1128/1195 passed.

## Left open

- Findings: none. The reviews' notes: an mtime drop is redundant with ctime, and a pre-merge budget comment line keeps its old total; nothing to change.
