# AR0519 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Delivery's review-needed reads `process\.env` in a regex as the secrets file too

- Kind: fix
- Found by: 2026-10-27-worker-7ea85a74 (worker), 2026-10-27
- Where: `packages/delivery/src/review-needed.ts:15`
- What: `DOT_ENV = /(?<!\w)\.env\b/` matches `.env` after a backslash, so a changed source line holding a regex such as `/process\.env\.(\w+)/` gets `review: the diff mentions .env in <path>`, though its doc (`packages/delivery/docs/commands/review-needed.md:17`) says `process.env` is not `.env`. The same miss AR0519 fixed in the core's env guard. [INFERENCE] from the regex; not run.
- Suggestion: `(?<![\w.]\\*)` in place of `(?<!\w)`, as `packages/core/src/env-refusal.ts` now has, with a row in its test; nothing else changes.
- Status: open
