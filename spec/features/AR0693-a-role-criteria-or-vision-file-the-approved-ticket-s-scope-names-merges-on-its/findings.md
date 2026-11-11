# AR0693 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. herdr's start-up pass test times out in the full suite on a loaded machine, and its leftover queue fails the next test

- Kind: test
- Found by: 2026-11-11-worker-07795aec (worker), 2026-11-11
- Where: `packages/herdr/test/herdr.test.ts:152`, `packages/herdr/test/herdr.test.ts:169`
- What: In `npm test` on a 3-CPU host with a load average of about 15, `before start nothing reaches herdr; …` failed three runs in a row with `waited 20 s for the start-up pass`. The start-up pass makes about 20 herdr calls one after another, and the fake `herdr` starts a new node process for each call, so under that load the pass takes longer than `until`'s 20 s. That test's plugin queue keeps running after it fails, and once `process.env.PATH` points at the next test's fake, it sends a `pane report-agent … --state working` call there, so `a prune in a process that never started …` fails too (`no workspace, nothing made`). Run alone, `node --import @arthur/core/testing --test packages/herdr/test/herdr.test.ts` passes all 11 tests. The branch does not touch herdr. Its failure keeps the review gate shut.
- Suggestion: stop the plugin (or wait for its queue to drain) in a `t.after` of the herdr test's `load`, so one test's leftover calls never reach the next test's fake. Give the start-up pass's `until` a wait sized for its number of calls, or make the fake answer faster (one long-lived process instead of a node start per call). The plugin's behavior stays as it is.
- Status: open
