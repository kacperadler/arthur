# AR0466 - Review 2

- Job: 2026-10-27-review-55a9e2ce
- Branch: arthur/2026-10-27-worker-cae1ba87
- Commit reviewed: 3cd65c3d9f748e5d02360c27e3e98e3bc290a6a5
- Verdict: PASS

## Final message

I found nothing that blocks the merge. Both review-1 findings are fixed, and the fix opens no gap that wasn't already there before it.

## Review-1 findings
1. **An owner's unchanged symlink was removed: fixed.** `merge-checks.ts:30` now records every symlink before the first step (`repositories(root, () => true)`). The sweep after each step only picks up symlinks that `escapes` flags (`:42`). So a symlink that is the same as in that first snapshot always stays. The new test in `merge-checks.test.ts` covers the case review-1 reproduced. The owner's `tools/py` points to the file `out/py` outside the checkout. A step removes that file, then makes a folder in its place. The test checks that no line is logged and the symlink stays. Putting the snapshot back to `repositories(root, escapes)` makes 1 test fail.
2. **The `folder !== root` guard had no test: fixed.** The "failed step" test now writes a `HEAD` file at the checkout's top. It then checks the logged lines and that `git rev-parse HEAD` still works. With `folder !== root &&` removed, 1 test fails.

## Does the fix open a new gap?
- **A step replaces an owner's symlink in place: no gap.** I tried this with a throwaway script that ran the real `stepRunner` in a `mktemp -d` folder, deleted afterwards. Each replaced symlink is removed with one line:
  - the owner's `tools/out` pointed to a folder outside; `ln -sfn <other folder> tools/out` replaced it;
  - the owner's `tools/py` pointed to a file; `rm` plus `ln -s` replaced it with a symlink to a folder outside;
  - a file that an owner's symlink points to inside the checkout became a symlink to a folder outside; that new symlink is removed.
  
  A replaced symlink has a new inode and change time, so it no longer matches the first snapshot.

## Notes (not blocking)
- **What the fix trades away.** Some owner symlinks point to a file that a step can write: in the checkout's `.git/objects`, `refs` or `logs`, in the temporary folder, or in the merge's cache. A step can now replace that file with a planted repository. The owner's symlink stays, and `git status` in it runs the planted fsmonitor.
  - I reproduced this with the same throwaway script, using `tools/g -> ../.git/objects/zz/f` and `tools/t -> $tmp/t/f`; both runs created their `pwned-*` file.
  - With the round-1 snapshot rule put back (a `sed` on `:30`, restored afterwards), both symlinks were removed. So this variant is new in this round.
  - The same attack already worked in round 1 through an owner's symlink to a folder in the temporary folder (`tools/dir`). Round 1 kept that symlink too, and review-1 accepted it.
  - `merge.md` now says plainly that an owner's symlink that hasn't changed stays "whatever its target became". This is exactly the rule review-1 asked for, and it needs the owner to have such a symlink. That's why I put it in the notes, not the findings.
- **`escapes` checks the path by its text (`:79`).** It joins the link's folder path, without resolving symlinks, with the link's target. Only when the checkout's own path goes through a symlink could a target with `..` in it be judged inside the checkout when it is outside. Using `realpathSync(dirname(link))` would close that.
- **Folders holding a `HEAD`.** Any folder holding a `HEAD` now counts as a repository, which is broader than the ticket's "`HEAD` and `objects/`". That is safer, since a linked worktree's Git folder can hold `commondir` in place of `objects`. The cost: a committed test fixture that holds a `HEAD` and that a step writes into is removed as a whole. Git can restore it.
- The worker's own finding F1 (the snapshot is taken after `git merge`) is still marked `open`, and that is correct.

## Checks run
- `npm run check`: tsc with no errors (exit 0).
- `node --test packages/delivery/test/merge-checks.test.ts test/structure.test.ts`: 27 run, 27 passed, 0 failed, 0 skipped. This matches the worker's claim.
- I did not run the full `npm test`, as you asked.
- Mutations, each restored with `git checkout`; `git status` is clean afterwards:

| Mutation | Tests failing in `merge-checks.test.ts` |
|---|---|
| `folder !== root &&` removed | 1 |
| Snapshot back to `repositories(root, escapes)` | 1 |
| Sweep counts every symlink (`() => true`) | 1 |
| `first === ".git"` check removed | 1 |
| Exception for symlinks to files turned off | 1 |

PASS