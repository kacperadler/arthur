# AR0490 - Review 2

- Job: 2026-10-29-review-358ec032
- Branch: arthur/2026-10-29-worker-6a44e150
- Commit reviewed: 9dbbfabfff8eb98cca6c2b9c5d2f7fbf1f4f3528
- Verdict: FAIL

## Final message

**Findings**

1. **The new owner-link protection can be bypassed by planting a repository one folder above the link's target. Blocking.**
   - **Where:** `packages/delivery/src/merge-sweep.ts:96-97` (`linked`).
   - **What's wrong:** an owner's link that leads into a folder a step writes is now judged by its target. But the stamp only covers the target itself and what is inside it. Git doesn't stop there: it starts from the physical path of its working folder and walks up. So a step can create `.git` in a parent of the target that is still inside the write folder. The owner's link keeps its stamp and stays, and the owner's next git call through it runs the planted config outside any sandbox.
   - **Reproduced** with a throwaway script, since removed:
     - The owner link is `acme/tools/box -> $TMPDIR/cache/box`. The runner is made with `TMPDIR` set to that write folder.
     - The step runs `git init -q $TMPDIR/cache && git -C $TMPDIR/cache config core.fsmonitor "touch …/pwned"`.
     - Result: the sweep printed no line and the link was kept. `git rev-parse --show-toplevel` in `tools/box` printed `…/writable/cache`, and `git status` there created `pwned`.
   - **Production case:** an owner link `tools/x -> /tmp/cache/x`, where `/tmp/cache` belongs to the owner, gets the same result. Git's ownership check passes, because the planted repository's working folder is owned by the same user.
   - **Why it fails the branch:** Done means asks that such a link be "judged by its target", so a step cannot plant a repository behind it (F2). This is a step planting a repository behind it, end to end.
   - **Same hole, other folders:** `/dev/shm/<dir>`, and `.git/objects/<xx>`, where a `HEAD`, `objects/` and `refs/` make the folder a bare Git folder.
   - **Possible fix:** for a judged link, also stamp `.git` and `HEAD` in each parent of the end path (and of each hop), from the write folder down to the end path.

**Notes (not blocking)**

- **Kernel-limit mutation:** changing `hops.length < 40` to `< 41` (`merge-sweep.ts:69`) passes all 20 tests in `merge-checks.test.ts`. It only changes the result for a chain of 41 links, which the kernel refuses anyway (ELOOP), so a git call can never reach through it. The worker's claim about 39 holds: that mutation fails the limit test.
- **`realpathSync` in `target`:** replacing `realpathSync(dirname(link))` with `dirname(link)` (`:68`) also passes all 20. Following the path one part at a time, and following each folder link as it comes, already gives the kernel's answer, so the call no longer changes the result. Done means asks for it, and it is there.
- **Open findings the worker recorded, not fixed here:**
  - **F1:** a merge with no step sweeps nothing, so a `HEAD` folder the branch commits stays in main's checkout. This is a gap against the ticket's goal; a follow-up ticket should take it.
  - **F2:** files the branch tracks get removed, which leaves main dirty.
  - **F5:** an owner's link into `.git/refs`, `.git/logs` or `.git` itself is removed after the first step, because `git merge` changed its target.
- **Owner link to `host.folder` removed:** `merge.test.ts` checks that an owner's link to the plugin's folder is removed after the first step, because the merge's caches change it. That is the safe direction, but the owner loses the link.
- **The worker's 6 manage failures did not reproduce:** my full run had 0 failures.
- **Budget:** the raise to 1677 is covered by AR-D308 in main's ticket.

**Checks run**

- **`npm ci` / `npm run check` / `npm test`** (one call, timeout 1800): `tsc` clean. 1283 tests: 1221 pass, 0 fail, 62 skipped.
- **Mutations in `merge-sweep.ts`, against `merge-checks.test.ts`:**

| Mutation | Result |
|---|---|
| `linked` always returns the link's own stamp | 5 tests fail |
| `tmpdir()` dropped from the write folders | 4 fail |
| `/dev` dropped | 1 fails |
| the `UNSEEN` condition dropped | 1 fails |
| a `.git` symlink stamped by itself | 1 fails |
| only the end of the chain checked | 1 fails |
| the folder check by plain prefix (no separator) | 1 fails |
| the `each === folder` case dropped | 1 fails |
| `<root>/.git` dropped from the write folders | 1 fails |
| limit 39 | 1 fails |
| limit 41 | **0 fail (not caught)** |
| no `realpathSync` | **0 fail (not caught)** |

- **Mutations in `merge-command.ts`:**
  - `stepRunner` moved after `git merge`: the new test in `merge.test.ts` fails.
  - `[host.folder]` replaced with `[]`: that same test fails, in a delivery test run of 92 pass, 1 fail.
- **Bypass probe** (the script above): link kept, `pwned` created.
- Every mutation was restored with `git checkout --`. `git status` is clean and no probe folder is left in `/tmp`.

FAIL