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

## F2. A test run leaves a fake agent of a continued job running

- Kind: test
- Found by: 2026-11-09-worker-bb08f8e6 (worker), 2026-11-09
- Where: `packages/core/src/fake-agent.ts`, started with `--continue -e packages/session/src/handoff-extension.ts`
- What: after `npm test` in this worktree, a process `node packages/core/src/fake-agent.ts <tmp>/run.json --continue -e .../session/src/handoff-extension.ts` was still running 54 minutes later, reparented to the user's init (ps: ppid 817), its temporary folder under `/tmp/arthur-test-*`. Which test started it was not traced [INFERENCE: one that continues a job with the session plugin's handoff extension loaded].
- Suggestion: find the test that continues a job with the handoff extension, and make it wait until the fake agent's process is gone (or kill it in `t.after`) before it ends.
- Status: open

## F3. A part's mime holding a line break splits its file line

- Kind: security
- Found by: 2026-11-10-review-2539324f (review), 2026-11-10
- Where: `packages/core/src/message-parts.ts:53`, read by `packages/orchestration/src/decision-proof.ts:17`
- What: the proof drops a file's line by its leading `[<kind>`, one line per part. The core's saved line writes the part's `mime` raw, and Telegram passes the client's `mime_type` through (`telegram/src/media-in.ts`), so a mime with `\n` would put the text after it on a line of its own, counted as the owner's words. [INFERENCE: not verified that Telegram delivers a line break in `mime_type`]
- Suggestion: have `received` (message-parts.ts) refuse a `mime` with a control character, or the saved line collapse whitespace in it; the proof stays line-based.
- Status: open
