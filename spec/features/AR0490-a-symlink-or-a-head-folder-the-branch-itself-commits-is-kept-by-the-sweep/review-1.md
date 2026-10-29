# AR0490 - Review 1

- Job: 2026-10-29-review-99b84863
- Branch: arthur/2026-10-29-worker-6a44e150
- Commit reviewed: 9e2b895b5d5b3f30f029d36e78ceab5862d9a83a
- Verdict: FAIL

## Final message

**Findings**

1. `packages/delivery/src/merge-sweep.ts:75-80` (`linked`) with `:62-72` (`target`). This misses one case the ticket's second Done-means point names: "an owner's symlink whose target a step can write … is judged by its target too, not kept as unchanged". `linked` only checks the target's final resolved path, after every link along the way has been followed. Hops in between are not checked. Bypass: the owner has `hop -> $TMPDIR/s`, and `$TMPDIR/s -> <a folder outside every write folder>`. The resolved path is outside the write folders, so `hop` is stamped by its own entry only. A step can write the temporary folder, so it re-points `$TMPDIR/s` at a repository outside the write folders that runs a hostile `core.fsmonitor`. A job's worktree is one such place, since a job's agent can write there. The resolved path is still outside the write folders, the stamp is the same, and `hop` is kept. I reproduced this with `owned`/`sweep` from the branch on a throwaway repo: `hop kept: true`, and after `git -C hop status`, `pwned: true`. The same gap exists for a write-folder hop anywhere in the chain (`link -> /outside/a -> $TMPDIR/s -> …`); I found that one by reading the code, not by running it. Fix: judge the link by its target when any hop it passes through, not only the last one, lies in one of the write folders. Add a test with this chain.

**Notes (not blocking)**

- `merge-sweep.ts:14`: the only Git folder `owned` counts is `join(realpathSync(root), ".git")`. If main's checkout has a `.git` file (separate git dir), the step sandbox writes the common dir's `objects/refs/logs` (`job-sandbox.ts:129-131`), but links into those folders are not judged by their target. Found by reading the code; main is normally a plain clone.
- The snapshot is now taken before `git merge`, and stamps of link targets are recursive. So an owner's link into `.git/refs`, `.git/logs` or `.git` itself is removed after the first step even if no step wrote anything there, because `git merge` itself changed its target. Also found by reading the code. It is the safe direction, but the owner loses that link.
- F2's cost is real and covered by the new merge test: a passed merge leaves main's checkout with tracked files deleted. It is documented in `merge.md` and logged as a finding.
- Commit `9e2b895b` has a `test` prefix but changes code (the `uncapped:` line now prints at the first step); the worker's message says so.
- `merge.test.ts` is outside the ticket's file list; the worker gives a reason.
- The budget raise to 1665 matches main's Decision AR-D306.
- Outside the range: the ticket's AR-D306 Decision line on main quotes a non-English voice note.
- The worker says it wrote a throwaway script under `/tmp`.

**Checks run**

- `npm ci`, `npm run check` (tsc clean), `npm test`, run in one call: 1281 tests, 1219 pass, 0 fail, 62 skipped. This matches the worker's numbers.
- `node --test packages/delivery/test/merge-checks.test.ts`: 18/18 pass.
- Mutations, each restored with `git checkout --`; the tree is clean:
  - In `merge-sweep.ts`, each of these was caught by at least one failing test:
    - `tmpdir()` dropped from the write folders;
    - the boundary check changed to `startsWith(folder)`;
    - `realpathSync(dirname(link))` changed to `dirname(link)`;
    - the `!seen.endsWith(UNSEEN)` condition removed;
    - a `.git` symlink stamped by itself only;
    - `"missing"` replaced by `stamp(path)`.
  - In `merge-command.ts`, run against the new merge test, each was caught:
    - `stepRunner` moved after `git merge`;
    - `[host.folder]` changed to `[]`.
  - Two of these mutations first ran in parallel on the same file; I re-ran both one at a time, and the results above come from those runs.
- Bypass repro of finding 1: throwaway `node -e` script against `owned`/`sweep`, in a scratch folder under the worktree, removed afterwards. Output: `hop kept: true`, `pwned: true`.

FAIL