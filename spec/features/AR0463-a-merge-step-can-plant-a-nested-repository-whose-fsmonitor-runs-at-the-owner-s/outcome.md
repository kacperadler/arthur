# AR0463 - Outcome

- Merged: 2026-10-26, `b2f98242`
- Branch: arthur/2026-10-26-worker-8e0940d9
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $4.85, reviews n/a; review rounds 3

## What went in

- `packages/delivery/src/merge-checks.ts`: each step of `arthur merge` (and the reinstall after a reset) is followed by a sweep of main's checkout: every `.git` folder or file a step made, or changed (its stamp of inode and change time, of itself and every entry inside it, differs from the one taken before the first step), is removed, with one line printed each; the checkout's own `.git` and a submodule's unchanged `.git` file stay.
- `packages/delivery/test/merge-checks.test.ts`: a planted `git init` with `core.fsmonitor`, a `.git` file swapped in another folder, an owner clone whose config a step appended to, one whose `.git` a step replaced, an unreadable or unremovable `.git`, a failed step, a real submodule kept.
- `packages/delivery/docs/commands/merge.md`, `docs/deploy.md`: a `.git` that was already there stays only while no step writes in it.
- `test/structure.test.ts`: delivery's line budget is 1500 (AR-D103).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1118/1185 passed.

## Left open

- Tickets from findings: AR0466 (F1: a repository under another name, or a symlink to one, is not swept), AR0467 (F3: a check running git in an owner clone deletes its history).
- F4 to F9, the reviews' other notes: dropped or fixed (findings.md).
