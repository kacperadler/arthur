# AR0395 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The job's sandbox writes every ref, so a program a job runs can still move main

- Kind: security
- Found by: 2026-11-02-worker-3b09a3f0 (worker), 2026-11-02
- Where: `packages/core/src/job-sandbox.ts:73`
- What: the ticket names AR0376's sandbox as the real bound, but `writable` grants the repository's whole `refs` and `logs` folders (a commit on the job's branch needs them), so a program the guard does not see (`node -e`) may write `refs/heads/main` in a sandboxed job, through a link it makes (`git --git-dir=<link> update-ref refs/heads/main <commit>`) or as a plain file. [INFERENCE] from line 73, not run in a sandbox: a `git commit` through such a link may instead fail on the main checkout's `index.lock`, which the sandbox keeps read-only. Only the merge's check (AR0361) catches a moved main, after the fact.
- Suggestion: bound ref writes outside the guard, for example a `reference-transaction` hook in the repository's own `hooks` (which the sandbox keeps read-only) that refuses an update to any ref but `refs/heads/<branch>` from a process in an `arthur-job-<id>.scope` cgroup; a `-c core.hooksPath=` the program passes would still skip it, so weigh that first. Out: the guard's bash parsing.
- Status: deferred (client summary)

## F2. bash-refusal.ts is yellow (207 lines)

- Kind: refactor
- Found by: 2026-11-02-worker-3b09a3f0 (worker), 2026-11-02
- Where: `packages/core/src/bash-refusal.ts`
- What: AR0395 added the written-path check, which took the file from green to 207 lines (`node --test test/structure.test.ts` prints it); the next guard rule pushes it toward red.
- Suggestion: move the `git` judgment (`git` inside `bashRefusal`, with `STASH`, `UNSEEN` and `MADE`) into a file of its own that gets `located`, `theirs` and `written` as arguments; no behavior change.
- Status: deferred (client summary)

## F3. a GIT_DIR exported in the same call is not checked against what the call writes

- Kind: security
- Found by: 2026-11-02-review-302a8f32 (review), 2026-11-02
- Where: `packages/core/src/bash-refusal.ts:132`
- What: `export GIT_DIR=/tmp/l; echo "gitdir: <root>/.git" > /tmp/l; git --work-tree=. commit -m x` gets past the guard. `docs/deploy.md` already lists an exported `GIT_DIR` as unseen, but the ticket names `GIT_DIR` among the ways in.
- Status: deferred (client summary)

## F4. confirms the worker's F1

- Kind: security
- Found by: 2026-11-02-review-302a8f32 (review), 2026-11-02
- Where: `packages/core/src/job-sandbox.ts:74`
- What: `writable` gives the job the repository's whole `refs` folder, so a link a program writes can still move `refs/heads/main`. Only AR0361's merge check catches it afterwards.
- Status: deferred (client summary)
