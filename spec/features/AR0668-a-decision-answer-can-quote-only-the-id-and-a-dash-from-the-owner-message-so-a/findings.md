# AR0668 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A transcript line's path is told apart only by its leading slash

- Kind: security
- Found by: 2026-11-09-worker-bb08f8e6 (worker), 2026-11-09
- Where: `packages/orchestration/src/decision-proof.ts:16`
- What: listen writes a transcribed part as `[<kind> <seconds> s] <transcript> (<path>)` (docs/listen.md), and the proof keeps the transcript and drops the trailing ` (<path>)` only when the path starts with `/`. Telegram and Discord save under the plugin's folder, an absolute path today [INFERENCE: from `join(folder, "media", ...)` in their media-in.ts, not from a run with a relative home]; a channel that handed a relative path would leave an audio file's name, which the sender chose, in the text his words are matched in.
- Suggestion: have the core's `message.part` contract say a part's `path` is absolute (and `received` refuse one that is not), so the proof's rule holds for every channel; or have listen mark the transcript itself, so the proof needs no path rule.
- Status: open
