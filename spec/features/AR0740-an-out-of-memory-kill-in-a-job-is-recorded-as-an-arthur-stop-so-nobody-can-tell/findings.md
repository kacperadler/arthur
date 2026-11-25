# AR0740 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The tests of the kernel's and systemd's part never run inside a job

- Kind: test
- Found by: 2026-11-24-worker-951d3c39 (worker), 2026-11-24
- Where: `packages/core/test/scope.test.ts:21`
- What: the tests marked `needsManager` skip where `systemctl --user show-environment` fails, and a job's sandbox reaches no user manager (`arthur spawn --help`, "The sandbox"), so a worker's and a reviewer's `npm test` skip them all: `node --import @arthur/core/testing --test packages/core/test/scope.test.ts` in this job ran 27 tests, 13 of them skipped. AR0740's own test of a real out-of-memory kill at the joint slice's cap (`a job without a cap whose process the kernel kills at the joint slice's cap ...`) is one of them: it was written but run by no job, and `npm run mutate` in a job cannot catch a mutant only such a test would.
- Suggestion: a check outside the sandbox that runs the `needsManager` tests on the branch (the checks of `arthur merge` run in a scope of their own, so they may be the place), its result shown to the review; what a job may reach stays as it is.
- Status: open

## F2. A job that runs bare does not see an out-of-memory kill

- Kind: fix
- Found by: 2026-11-24-worker-951d3c39 (worker), 2026-11-24
- Where: `packages/core/src/job-memory.ts:27`
- What: without a scope (no user manager: macOS, a container) there is no `memory.events` to read, so a process the kernel kills when the machine runs out of memory is not seen: the watch samples only the job's own cap (`ps`, every 10 s). By `job-ending.ts:13` the job then ends `failed: the agent was killed by SIGKILL` when the agent was the one killed, and goes on when it was a process of a tool call; neither says memory. Not run: an inference from those lines.
- Suggestion: on Linux, read the kernel's log for a kill of a process below the wrapper when the agent dies of SIGKILL; macOS has no such log line to match.
- Status: open
