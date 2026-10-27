# AR0467 - Outcome

- Merged: 2026-10-27, `b7f8edf8`
- Branch: arthur/2026-10-27-worker-bdb8c92f
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $3.17, reviews n/a; review rounds 2

## What went in

- `packages/delivery/src/merge-checks.ts`: the fingerprint of each `.git` under the main checkout, taken before and after every merge step, ignores `index` at any depth and `sharedindex.<hash>`, which git rewrites on a read. It now records each entry's owner and group besides inode, mode and change time. The change time of the `.git` folder and of any folder holding an `index` is replaced by their extended attributes (ACLs included), read with one `python3 -I` call; when python3 fails, their change time counts again. So a step that only runs `git status` or `git log` in one of the owner's clones keeps it, while a written hook or `core.fsmonitor`, a `chmod`, a `chgrp` or an ACL still removes that `.git`.
- `packages/delivery/test/merge-checks.test.ts`: a read (plain, linked worktree, split index) keeps the clone; a planted hook or fsmonitor, a `chmod`, an ACL that leaves the mode, a `chgrp` to another group, and a read with a failing python3 each remove it.
- `packages/delivery/docs/commands/merge.md`: says which changes to a clone's `.git` remove it.
- `test/structure.test.ts`: delivery's line budget 1552 -> 1564 (AR-D144, AR-D148).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1132/1199 passed.

## Left open

- Tickets from review notes: AR0479 (F1).
