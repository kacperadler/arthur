# AR0597 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. `arthur prune` removes the worktree and branch a job's rewritten record names

- Kind: security
- Found by: 2026-11-01-worker-ff79fdb2 (worker), 2026-11-01
- Where: `packages/core/src/job-records.ts:142-166` (`git -C <root> worktree remove <worktree>`, `git branch -d <branch>`), `packages/core/src/remote-job.ts:82-91` (the same there)
- What: prune reads `root`, `worktree` and `branch` from the record, which the job's agent writes, and runs Git outside any sandbox on them. A job whose agent rewrote them to another job's clean worktree and merged branch (its own project's or, in a repository its `root` names, another's) gets that worktree removed and that branch deleted by the owner's next `arthur prune`. [INFERENCE: read from the lines named; no forged record was pruned.] AR0597 checks these fields at `arthur continue` only (`misplaced`, `packages/core/src/job-sandbox.ts`).
- Suggestion: before a prune's Git calls, check the record with the same `misplaced(id, record, <the project's checkout now>)` and the branch against `arthur/<id>`, keeping the record with the reason when it fails. Out: the record's other fields.
- Status: ticket AR0610

## F2. A rewritten `extensions` makes the wrapper grant and create `<home>/<any name>/<id>`

- Kind: security
- Found by: 2026-11-01-worker-ff79fdb2 (worker), 2026-11-01
- Where: `packages/core/src/job-sandbox.ts:75` (`writable`'s plugin folders), `packages/core/src/wrapper.ts:77` (`extensions` read from the record)
- What: the record's `extensions`, which the agent writes, names the paths whose package folder gives `<home>/<folder>/<id>`, made by the wrapper outside the sandbox and granted to the next run. A line such as `../../../../x/orchestration/a.ts` grants `<home>/orchestration/<id>`, a folder of another plugin, keyed by this job's id. [INFERENCE: traced from `writable`; no forged record was run.] Writes stay under the home and under the job's id; whether a plugin reads such a folder was not checked.
- Suggestion: take the extensions from the runner (`registerExtension`, the spawn's list) on the wrapper's command line as AR0597 does for the place, or keep only the lines that name a registered extension. Out: `guarded` (AR0512).
- Status: deferred (client summary)

## F3. no test covers the refusal on another machine

- Kind: fix
- Found by: 2026-11-01-review-074d977b (review), 2026-11-01
- Where: `packages/core/src/remote-job.ts:73`
- What: Changing the `root` step to return the record's own `root` passed all 46 tests in `machine.test.ts`. I found no exploit through it: the worktree path and the `worktrees/<id>` check still pin the repository. But a regression in that wiring would go unnoticed.
- Status: deferred (client summary)

## F4. `misplaced` never compares `project` directly

- Kind: fix
- Found by: 2026-11-01-review-074d977b (review), 2026-11-01
- Where: `packages/core/src/job-sandbox.ts:82`
- What: If two configured projects share one Git top level, a rewritten `project` passes the check. The next run then gets the other project's folders and job records unhidden instead of its own.
- Status: deferred (client summary)
