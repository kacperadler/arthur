# AR0467 - Review 1

- Job: 2026-10-27-review-4e30bd72
- Branch: arthur/2026-10-27-worker-bdb8c92f
- Commit reviewed: a0fa788ebcc1555171d033fff78ce54807a2d5eb
- Verdict: FAIL

## Final message

I'm failing this branch. It fixes what AR0467 asked for, but it drops the folder change time from the check, so a step can now give other users write access to a clone's `hooks/` and the clone is kept. On the base commit that clone was removed.

## Findings

1. **`packages/delivery/src/merge-checks.ts:77`: changing a folder's group is no longer detected.** The stamp now writes `${stat.mode} ${stat.isDirectory() ? "" : stat.ctimeMs}`. For a folder it records the mode and drops the change time, which was the only part that caught a `chgrp`. I tested it with a throwaway test in my checkout, deleted afterwards. In the fixture's `tools/scratch`, I made `.git/hooks` mode 775 before the first step, then ran the step `chgrp docker tools/scratch/.git/hooks`:
   - **At `a0fa788e`:** `lines` is `[]` and the folder stays as `drwxrwxr-x docker`. Anyone in `docker` can now plant a `post-checkout` hook, which runs when the owner next uses git in that clone, outside any sandbox.
   - **At the base `d48f1b85`** (same test, base `merge-checks.ts`): `removed tools/scratch/.git, which chgrp docker tools/scratch/.git/hooks left: …`, and the folder is gone.

   Why this fails the branch:
   - It is the threat the branch's own new test names ("a step that only opens a folder in a clone's .git to others, so another user could plant a hook there later, has it removed"). That test covers only `chmod`.
   - The updated `docs/commands/merge.md` says a `.git` in which a step "changed a folder's permissions" is removed. For a change of group, that is now false.
   - It weakens the AR0463 / AR-D101 protection, which the ticket says must "still remove a planted fsmonitor or hook".

   It needs a folder created group-writable, which umask 002 does (common on systems with a group per user); I ran with umask 0077. The cheap fix is to add `stat.uid` and `stat.gid` to the stamp, plus a test for a step that only changes the group.

   [INFERENCE] `setfacl -m u:<other>:rwx` on a 775 folder leaves `st_mode` unchanged, because the ACL mask is already `rwx`, so it is probably missed the same way. `setfacl` is not installed here, so I could not run it.

## Notes (not blocking)

- The `index` / `sharedindex.<hex>` exclusion matches by name at any depth, so a step can add a file with one of those names anywhere in a `.git` without notice. I found no git path that executes a file with those names or reads config from it, so it does no harm.
- Removing `${stat.ino}` from the stamp is caught by no test; the change time covers a replaced file anyway. That code predates this range.
- Everything the worker reported matches what I see: the budget is 1557, and the only change in `test/structure.test.ts` is the `delivery` line (AR-D144). The docs and tests stay within the ticket's Scope.

## Checks run

- `npm run check`: exit 0.
- `node --test test/structure.test.ts packages/delivery/test/merge-checks.test.ts`: 23 tests, 23 pass, 0 fail. This matches the worker's claim.
- `cat packages/delivery/src/*.ts | wc -l`: 1557.
- The full `npm test` was not run, as you asked.
- Mutations of `merge-checks.ts`, each run against `merge-checks.test.ts`; each of the first five failed 1 test, so the tests catch them:
  - `READ` filter removed
  - `stat.mode` dropped from the stamp
  - folder change time kept in the stamp
  - `sharedindex` dropped from `READ`
  - `READ.test(name)` instead of `READ.test(basename(name))`
- Mutation removing `stat.ino` (code from before this range): 0 fail, not caught.
- The `chgrp` test above: kept at `a0fa788e`, removed at the base.
- All mutations and the test file are reverted; `git status --short` prints nothing.

FAIL