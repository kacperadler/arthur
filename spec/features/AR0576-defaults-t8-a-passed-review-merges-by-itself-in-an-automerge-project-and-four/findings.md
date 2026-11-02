# AR0576 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A restart of arthur run kills a merge it started on its own

- Kind: fix
- Found by: 2026-10-30-worker-01f1b438 (worker), 2026-10-30
- Where: `packages/delivery/src/pass-forward.ts:31`
- What: the merge after a PASS, a `no review` or CI passed runs as a child of `arthur run` (`execFile`), so it lives in arthur run's process tree and systemd cgroup. A `systemctl --user restart arthur` (a deploy, or the session plugin's restart when due, which waits only for jobs, and a child merge is no job) kills it mid-step: main may keep the merge commit with its checks not run, the lock is taken over by the next merge, and the coordinator gets no wake. [INFERENCE: read from the code; not reproduced.]
- Suggestion: count a held merge lock (`<delivery folder>/<project>/merge.lock`) as work in progress where the restart waits for jobs, or run the child in a transient systemd scope of its own as the merge's steps do. Out: making the merge steps async.
- Status: deferred (client summary)

## F2. pass-forward.ts is not on the always-review list

- Kind: security
- Found by: 2026-10-30-worker-01f1b438 (worker), 2026-10-30
- Where: `packages/delivery/src/delivery-options.ts:17`
- What: `auto-merge.ts` and `merge-command.ts` are held, so a branch changing them is always reviewed and never merged on its own. `pass-forward.ts`, which now decides when `arthur run` merges with no one looking, is not: a branch of 30 lines or fewer changing it, with passing checks (the job's own word), gets `no review` and, with autoMerge on and CI green, merges itself.
- Suggestion: add `**/pass-forward.ts` to `ALWAYS_REVIEW`, the example config's list and the list in `docs/commands/review-needed.md`; it changes the default, so the owner decides.
- Status: deferred (client summary)

## F3. Still open from review-1, and the worker says so

- Kind: fix
- Found by: 2026-10-30-review-d2219d8c (review), 2026-10-30
- Where: `packages/delivery/src/auto-merge.ts:28`
- What: A FAIL on an older commit does not stop a `no review` answer on a newer tip from merging with nobody watching.
- Status: deferred (client summary)
