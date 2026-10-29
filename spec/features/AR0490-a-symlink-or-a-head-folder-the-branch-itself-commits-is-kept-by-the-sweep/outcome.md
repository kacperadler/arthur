# AR0490 - Outcome

- Merged: 2026-10-29, `cab65080`
- Branch: arthur/2026-10-29-worker-6a44e150
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md FAIL, review-4.md PASS
- Cost: worker $10.39, reviews $3.56; review rounds 4

## What went in

- `packages/delivery/src/merge-command.ts`: the snapshot of the owner's checkout is taken before `git merge`, so a symlink or a folder holding a `HEAD` the branch itself commits is removed after the first step; the `uncapped:` line is still printed in its place.
- `packages/delivery/src/merge-sweep.ts`: an owner's symlink is judged by its target when any link of its chain, or its end, lies in a folder a step writes (the checkout's `.git`, the temporary folder, `/dev`, the delivery folder), with `.git` and `HEAD` stamped in each folder above, so a step cannot re-point it or plant a repository behind it; a link is resolved from the real folder it sits in, as the kernel does, at most 40 links deep.
- `packages/delivery/test/merge-checks.test.ts`, `merge.test.ts`: a committed symlink and HEAD folder, a chain through the temporary folder, a repository planted one or two folders above a target and in the temporary folder itself.
- `packages/delivery/docs/commands/merge.md`; `test/structure.test.ts`: delivery 1636 -> 1686 (AR-D306, AR-D308, AR-D315).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1219/1287 passed.

## Left open

- Deferred (client summary): F1. A merge with no step sweeps nothing, so a repository the branch commits stays in main's checkout
- Deferred (client summary): F2. A branch that adds a Git folder as a test fixture fails its checks, and a passed merge leaves main's checkout dirty
- Deferred (client summary): F3. A python3 failure on a linked target folder removes the owner's symlink, and the line names the wrong reason
- Deferred (client summary): F4. Main's checkout with a `.git` file judges no link into its common Git folder by its target
- Deferred (client summary): F5. An owner's link into `.git/refs`, `.git/logs` or `.git` is removed after the first step though no step wrote there
- Deferred (client summary): F6. An owner's link to the delivery folder is removed after the first step of every merge
