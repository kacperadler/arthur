# AR0610 - arthur prune and a dropped ticket remove only the worktree and branch the spawn made, not what the job record names

```json
{
  "id": "AR0610",
  "title": "arthur prune and a dropped ticket remove only the worktree and branch the spawn made, not what the job record names",
  "date": "2026-11-03",
  "budget": 8
}
```

## Description

`arthur prune`, the prune on another machine, and the cleanup of a dropped ticket take the worktree and the branch to remove from the job's own record, which the sandboxed job may rewrite. After this change they act only on the place the spawn made (`<checkout>/../.arthur-worktrees/<id>` and `arthur/<id>`); a record that names anything else keeps its worktree, branch and record, and the prune says why. The owner's branches and other jobs' worktrees can no longer be removed by a job that chose the target.

## Goal

Close the last path of the threat AR0597 fixed for `arthur continue`: Git calls outside the sandbox whose targets a prompt-injected job chose. These are the owner's branches and the worktrees of running jobs.

- Kind: security

Evidence:
- `packages/core/src/job-records.ts:138`: `prune` reads `root`, `worktree` and `branch` from the job's record. It then runs `git worktree remove <worktree>` (`:157`) and `git branch -d <branch>` (`:165`) on them, outside any sandbox.
- `packages/core/src/job-records.ts:50`: `host.jobs.list()` also takes `branch` (and `tickets`, from `task`) from the record.
- `packages/delivery/src/ticket-prune.ts:19,24`: when a ticket is dropped, each ended local job of that ticket gets `git branch --quiet -D <job.branch>`, a force delete, using the branch name the record holds.
- `packages/core/src/remote-job.ts:83,88`: the prune on another machine reads the same three fields there.
- `docs/deploy.md:36`: a sandboxed job "write[s] only in the job's worktree and record", so the agent can rewrite all of these fields.
- AR0597 closed this hole for `arthur continue` only: `misplaced()` (`packages/core/src/job-sandbox.ts:82-85`) checks the record against `<checkout>/../.arthur-worktrees/<id>`; `packages/core/src/machine-sync.ts:41` refuses a copied record whose branch is not `arthur/<id>`. Prune and the drop path do neither check.
- The same gap is AR0597 F1, settled `deferred (client summary)`; no ticket covered it.
- No test in `packages/core/test/job-records.test.ts` or `packages/delivery/test/merge.test.ts` prunes a record whose `root`, `worktree` or `branch` was changed.
- What can go wrong [INFERENCE, read from the code, not run]: a job of a ticket later dropped writes `branch` = an unmerged branch of another job or of the owner, and the drop deletes it with `-D`; a job writes `worktree` and `branch` = another job's clean worktree, and the next prune (the daily `manage.prune`, unwatched) removes it with its ignored files, `.arthur-stash` included (`packages/core/src/bash-refusal.ts:15`).

## Done means

- A local prune of a record whose `worktree` or `root` fails `misplaced(id, record, <the project's checkout now>)`, or whose `branch` is not exactly `arthur/<id>`, removes no worktree, deletes no branch, keeps the record, and prints why; a test for each field fails if the check is removed.
- The same for the prune on another machine (`remote-job.ts`), with its own test.
- Dropping a ticket whose ended job's record names another branch deletes no branch and says why; a test proves the other branch survives.
- A record with the spawn's own fields still prunes as today (existing tests pass).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/job-records.ts`: `prune` checks worktree (via `misplaced`) and branch (`arthur/<id>`) before its Git calls.
- `packages/core/src/remote-job.ts`: the same check in the remote prune.
- `packages/delivery/src/ticket-prune.ts`: the `-D` only on `arthur/<id>` of a job whose place passes the check.
- Their tests in `packages/core/test/` and `packages/delivery/test/`.

Out:
- The record's other fields (`extensions`, AR0597 F2).
- The worktree guard.

## Decisions

- 2026-11-03: Source: audit spec/quality/2026-11-03.md
- 2026-11-03: Source: F1 of AR0597
- 2026-11-03: AR0610 approved: prune and a dropped ticket remove only the worktree and arthur/<id> branch Arthur made for the job; after Group 2; the owner: "Sounds good, "remove only the ones Arthur created for that job"" (AR-D465)
