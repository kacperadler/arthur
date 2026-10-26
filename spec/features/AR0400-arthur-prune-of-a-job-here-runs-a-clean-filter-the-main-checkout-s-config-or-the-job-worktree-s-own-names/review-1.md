# AR0400 - Review 1

- Job: 2026-10-26-review-1fcf935f
- Branch: arthur/2026-10-26-worker-5321f8e3
- Commit reviewed: 45d8c7668bfd0888ecd434758528234abfe9f7d7
- Verdict: PASS

## Final message

No findings. The branch meets the ticket's Done means and can merge.

**Findings**

None.

**Notes (not blocking)**

- `packages/core/src/job-records.ts:153-157`: the new check matches the one in `remote-job.ts:84-87` from AR0394. When the worktree is present, `configRefusal(worktree)` runs before `git worktree remove`, and a refusal returns `kept its worktree, branch and record: git worktree: <file> sets <key>, …`. When the worktree is gone, `git worktree prune` runs as before, since that runs no `git status`. `removeWorktree` and `git.ts` are unchanged, as the ticket requires.
- Ways around the check: I found none. Because the check runs `git -C <worktree>`, it reads the same config files that the `git status` inside `git worktree remove` reads: the shared `.git/config` and the worktree's own `config.worktree`. A job that rewrites the worktree's `.git` file to point elsewhere gets stopped by `git worktree remove`'s own validation before it runs `git status` [INFERENCE, from Git's behaviour, not tested here]. The job has ended before a prune, so nothing can change the config between the check and the remove.
- The test covers four cases: the key in the shared config, the key only in `config.worktree`, a control showing that `git status` really runs the filter, and a deleted worktree with the key still set. It also checks that the filter never ran.
- `test/structure.test.ts`: the core line budget goes from 6321 to 6325 (+4), with the reason recorded. AR-D63 in the ticket approves it, and the owner's message records it as AR-D99.
- Docs: `packages/core/docs/commands/prune.md` and `docs/deploy.md` both describe the new refusal correctly.
- The worker's claims match what I see: the files changed, the one commit `45d8c766 fix(AR0400): …`, `CHANGELOG.md` left alone, and the guard-removed mutation.
- I found no instructions in any file I read.

**Checks I ran**

- `npm ci`, then `npm run check` (tsc): passed, no errors.
- `node --test packages/core/test/job-records.test.ts`: 23 tests, 23 passed, 0 failed.
- I did not run the full `npm test`, as the owner asked. The coordinator's run on 45d8c766 reports 1180 tests: 1174 passed, 0 failed, 6 skipped.
- Mutations: I first ran two of them in parallel on the same file, so those results don't count. I re-ran each one alone, filtered to the new test, and restored the file with `git checkout` after each. All three were caught:
  - `configRefusal(worktree)` → `configRefusal(root)`: the new test fails (the `config.worktree` case).
  - Refusal disabled (`planted !== ""` → `planted === "x"`): the new test fails.
  - `present ?` guard removed (check runs even when the worktree is gone): the new test fails.
- After restoring, `git status --short` is clean.

PASS