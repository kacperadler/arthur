# AR0683 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. npm test runs about 10 files at once on a job's 3 cores

- Kind: perf
- Found by: 2026-11-17-worker-1fa279f7 (worker), 2026-11-17
- Where: `package.json:16` (`npm test`, no `--test-concurrency`)
- What: in a job on this server, `node -p 'require("os").availableParallelism()'` prints 11 while the job's cgroup allows 3 CPUs (`cpu.max` = `300000 100000`). `node --test` runs files with that parallelism minus one by default, so about 10 at once [INFERENCE: Node's documented default for `--test-concurrency`; not observed]. `npm test` used 1948 to 1969 CPU-seconds in about 707 s wall (`/usr/bin/time npm test`, three runs, report.md), which is CPU-bound on the quota. Bun, which follows the cgroup, reports 3.
- Suggestion: AR0671 times `npm test` with `--test-concurrency` set to the cgroup's CPUs (3 here) against the default, and keeps the faster one; nothing else changes here.
- Status: open
