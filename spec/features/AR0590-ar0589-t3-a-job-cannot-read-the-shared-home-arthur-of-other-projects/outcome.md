# AR0590 - Outcome

- Merged: 2026-10-31, `c966fcae`
- Branch: arthur/2026-10-31-worker-db9e8a7b
- Reviews: review-1.md PASS
- Cost: worker $12.58, reviews $0.38; review rounds 1

## What went in

- docs/deploy.md: the threat model says a job reads only its own record, its project's records and the projects lists of the shared home, and that the home is hidden on another machine too.
- docs/plugin-api.md: `folder` cannot be read inside a job's sandbox; new AR0590 changes entry.
- packages/core/docs/commands/jobs.md: inside a job, `arthur jobs` lists the records its sandbox shows.
- packages/core/docs/commands/spawn.md: "The sandbox" describes the home and `.arthur-worktrees` hidden whole with shown paths, and the log line's `(shown: <path>)`.
- packages/core/src/job-sandbox.ts: the sandbox script accepts `+<path>` shown paths; `hidden()` hides the home and each `.arthur-worktrees` whole and shows the job's record, its project's records, the projects lists and its own worktree; the log line names shown paths.
- packages/core/src/job-state.ts: `jobIds` skips a record this process cannot open.
- packages/core/src/plugin.ts: the `Host.folder` comment says the folder cannot be read inside a job's sandbox.
- packages/core/test/sandbox.test.ts: unit test of the home part of `hidden()`; the `~/.ssh` test expects the home part; the AR0593 test adds a worktree made during the install and checks the log's shown record.
- test/job-home.test.ts: end-to-end test of a real sandboxed shop1 job with every in-job plugin, covering the denied home reads and `jobs`, `board`, `findings` and `ci` answering for shop1.
- test/structure.test.ts: core line budget 6600 → 6606.
- spec/features/AR0590-ar0589-t3-a-job-cannot-read-the-shared-home-arthur-of-other-projects/findings.md: F1 (fixed in fea1a112) and F2 (open).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1366/1435 passed.

## Left open

- Deferred (client summary): F2. What a job's sandbox shows now also follows the record fields its agent can rewrite
- Deferred (client summary): F3. the sandbox takes the job's project and worktree from the job's record, which the agent can rewrite
