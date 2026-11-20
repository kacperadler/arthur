# AR0718 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The fake herdr's state file is written through one shared temporary name, so two writers at once fail a herdr test

- Kind: test
- Found by: 2026-11-17-worker-49b51da7 (worker), 2026-11-17
- Where: `packages/herdr/test/fake-herdr.ts:130-133`
- What: `save` writes every state to `.state.json`, then renames it to `state.json`. In one of six full `npm test` runs (report.md, run 3, default concurrency, commit `7a418f2b`) `packages/herdr/test/herdr.test.ts`, "start makes the arthur workspace, its first tab the coordinator running arthur attach again and again; a later start makes no second one", failed at `box.server.seed([])` (`herdr.test.ts:74`) with `ENOENT: no such file or directory, rename '.../.state.json' -> '.../state.json'` from `fake-herdr.ts:132`. It passed in the other five runs. [INFERENCE: another writer, a fake `herdr` call of the coordinator's attach loop, renamed the shared `.state.json` away between this writer's write and rename; not traced.] Two writers can also lose each other's change (read, then save the whole state).
- Suggestion: write through a name of the writer's own (`.state.json.<pid>`, or the test's own name for `seed`) before the rename, so a rename never meets another writer's file. Whether a lost update matters to the test's assertions stays out.
- Status: ticket AR0728

## F2. adds to F1

- Kind: fix
- Found by: 2026-11-17-review-cf4f28c9 (review), 2026-11-17
- Where: `packages/herdr/test/fake-herdr.ts:132`
- What: It is not limited to default concurrency. My first `npm test` on `187e41a7`, at `--test-concurrency=3`, failed the same way: `ENOENT` on the rename at `herdr.test.ts:74` (`seed`). So F1's flake also hits the new default that this branch sets. The file passed 3 of 3 runs alone, and my second full run passed.
- Status: ticket AR0728
