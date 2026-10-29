# AR0554 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The core's line for an unclaimed voice note still names the voice plugin

- Kind: ux
- Found by: 2026-10-29-worker-7b9c5d1f (worker), 2026-10-29
- Where: `packages/core/src/message-parts.ts:16`
- What: `NOT_TRANSCRIBED` is `[voice note not transcribed: the voice plugin is not enabled]`, sent to the coordinator and the owner when no plugin claims a voice part. Since AR0554 there is no plugin of that name: the one to enable is `listen`. The core is outside AR0554's Scope, and the ticket keeps the coordinator's lines as they are, so it was left; `packages/core/test/parts.test.ts:60`, `packages/listen/docs/listen.md` ("Without the plugin enabled") and `spec/roadmap.md` entry 49 quote it. The video plugin's own line (`not transcribed: the listen plugin is not enabled`) was renamed in AR0554, as its doc names the plugin.
- Suggestion: `[voice note not transcribed: the listen plugin is not enabled]`, with the test, the listen doc and entry 49 updated; the part kind `voice` stays.
- Budget: 0.3
- Status: open
