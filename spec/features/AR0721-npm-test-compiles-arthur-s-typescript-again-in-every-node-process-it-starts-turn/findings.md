# AR0721 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The test run's compile cache grows by about 7 MB and 1217 files with every `npm test`, and nothing removes it

- Kind: perf
- Found by: 2026-11-18-worker-3afab526 (worker), 2026-11-18
- Where: `packages/core/src/test-env.ts:16`
- What: `node_modules/.cache/arthur-test-compile` held 20 MB in 2832 files after one `npm test` from an empty folder, 27 MB in 4049 after the second and 34 MB in 5266 after the third (`du -sm` and `find -type f | wc -l` after each run, on `1d65b9c9`): 1217 new files each time. One file alone shows the same: `NODE_COMPILE_CACHE=<folder> node --import @arthur/core/testing --test packages/commit-rules/test/commit-rules.test.ts` three times left 119, 126 and 133 files. Node keeps one entry per module path [INFERENCE: the new entries are the modules a test writes under the kit's temporary folder, whose path is new in every run; not traced to their files]. A job's worktree gets a new `node_modules`, so only a checkout that lives long (the main one) grows without end: about 700 MB and 120,000 files after 100 runs. `npm ci` empties it, as `rm -rf node_modules/.cache/arthur-test-compile` does.
- Suggestion: the kit's first process of a run (the one that finds `NODE_COMPILE_CACHE` unset) removes the folder once it holds more than a set number of files, or the entries not changed for some days; a cold run costs about 135 CPU-s more than a warm one (1041 against 907 CPU-s, measured), so a rare reset is cheap. Out: a cache folder per run, which loses the warm start of `node --import @arthur/core/testing --test <file>`.
- Status: open
