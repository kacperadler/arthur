# AR0592 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. arthur.mmd's status lines are stale

- Kind: docs
- Found by: 2026-10-31-worker-5c004deb (worker), 2026-10-31
- Where: `arthur.mmd:1-3`
- What: line 1 says "the state of main on 2026-10-26", and line 3, the list of merged entries per plugin, names no entry of listen (81) or video, both built and green in the same diagram. This branch added discord's entry 89 to that line only.
- Suggestion: rebuild lines 1 and 3 from `spec/build.json` and `packages/` as of the merge; nothing else in the diagram changes.
- Status: deferred (client summary)

## F2. The Discord backlog reads at most 100 messages per channel

- Kind: fix
- Found by: 2026-10-31-worker-5c004deb (worker), 2026-10-31
- Where: `packages/discord/src/receive.ts:68-80`
- What: at each new session the plugin asks `GET /channels/{id}/messages?after=<id>&limit=100` once per text channel; more than 100 messages in one channel within the 10 minutes Arthur was away leaves the rest unread, with no line saying so. Rare for one owner, not tested.
- Suggestion: page with `after=<newest id read>` until a page holds fewer than 100, or say once that the rest was not read.
- Status: deferred (client summary)
