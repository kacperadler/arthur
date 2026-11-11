# AR0689 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Mutating test/mutate.ts can leave a fixture's blocking test running

- Kind: test
- Found by: 2026-11-11-worker-0501072d (worker), 2026-11-11
- Where: `test/mutate.ts:211` (`passes` spawns each test run `detached`), `test/mutate.test.ts` ("a mutant whose tests the deadline cuts", "a signal mid-run")
- What: after `npm run mutate` on this branch, which changes `test/mutate.ts`, Arthur reported two processes still running: `node --test packages/a/test/limit.test.ts` (pid 2459938) and its child (2459944). Both were in their own process group, their parent was pid 817 rather than any process of the job, they had been running for 29 minutes, and their cwd was a fixture folder under `/tmp/arthur-test-QYQD0W/`. That is the test from those two tests' fixtures that blocks forever. [INFERENCE] A mutant of `test/mutate.ts` made the inner mutate (the one `mutate.test.ts` starts) leave that test running. The outer mutate stops only the process group of `mutate.test.ts`. The inner mutate's test runs are `detached` into groups of their own, so they outlive it. Not reproduced deliberately; the timing points to the first `npm run mutate` call, which ran for 1164 s.
- Suggestion: have each process `mutate.test.ts` spawns, and each fixture's blocking test, end when its parent goes away. One option: the blocking fixture exits once `process.ppid` changes. Another: run the fixtures under a cgroup or systemd slice that is torn down after the test. The deadline and the resume logic stay as they are.
- Status: open
