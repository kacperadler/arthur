# AR0443 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A test's sandboxed job walks the whole temporary folder to hide its env file

- Kind: perf
- Found by: 2026-10-26-worker-1bf07670 (worker), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts:37` (the walk), `packages/core/src/testing.ts:133` and the tests' `jobRunner(home, root, join(root, "env"), ...)`
- What: a test's env file lies under `/tmp`, so every sandboxed job of a test grants a read rule on each entry of `/tmp`, about 31800 on this host (`python3` listing of `/tmp`). Measured with `sandboxed(["/tmp/ar0443-probe"], hidden, "true", ...)`: probe 356 ms and run 346 ms with a hidden file under `/tmp`, against 23 and 21 ms with none or one under `/var/lib`. The probe and the start each pay it, so each job run of a test costs about 0.7 s more; the real env file (`~/.config/arthur/.env`) walks a few dozen entries.
- Suggestion: let the probe check the sandbox without the walk (it only finds the agent), or have the test kit put its jobs' env file in a folder with few entries above it, such as a temporary folder made outside `/tmp`'s crowded level. Out: dropping the walk, which is the bound.
- Status: open
