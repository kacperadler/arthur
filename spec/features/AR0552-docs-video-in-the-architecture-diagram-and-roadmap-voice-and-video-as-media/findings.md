# AR0552 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The versions diagram names voice but not video

- Kind: docs
- Found by: 2026-10-28-worker-eddb9bac (worker), 2026-10-28
- Where: `docs/architecture/versions.mmd:8`
- What: the first version's plugin groups list `voice` (`p2[delivery, github,<br/>commit-rules, voice]`) and no `video`, though the video plugin is built (AR0551) and every other diagram now names it. The file is outside this ticket's Scope.
- Suggestion: add `video` next to `voice` in that node; nothing else changes.
- Budget: 0.3
- Status: open

## F2. Roadmap entry 81 still describes voice before AR0550

- Kind: docs
- Found by: 2026-10-28-worker-eddb9bac (worker), 2026-10-28
- Where: `spec/roadmap.md:834`
- What: entry 81 says voice claims every `voice` part only; since AR0550 it also claims `audio` parts and provides `voice.transcribe` and `arthur transcribe` (the vision's plugin table and the README's plugin list say so). Entry 102 (video) names `voice.transcribe` with AR0550, so a reader of 81 alone does not find what 102 depends on.
- Suggestion: one "Also delivers (AR0550)" line under entry 81 naming `audio` parts, `voice.transcribe` and `arthur transcribe`, in the shape entry 89's "Also delivers (AR0127)" uses.
- Budget: 0.3
- Status: open

## F3. The install-timeout test in limits.test.ts fails under load

- Kind: test
- Found by: 2026-10-28-worker-eddb9bac (worker), 2026-10-28
- Where: `packages/core/test/limits.test.ts:153`
- What: in a full `npm test` while other worktrees ran their suites, "a timeout during the install a prepare asked for stops it, though it ignores SIGTERM, names the install, and starts no agent" failed after 22 471 ms with `timed out waiting for the install's process` (line 160, `until` at line 42 gives up after 20 s); run alone with `--test-name-pattern` it passed in 8 297 ms. The job's limit is `timeoutMinutes: 0.05` (3 s), so under load the job can be stopped before the install writes its pid file, and the test then waits for a file that never comes. AR0544's review-1.md:17 saw the same test fail under load.
- Suggestion: make the install's start independent of the 3 s limit, for example wait for the pid file or the job's end, whichever comes first, and assert the ended reason in both cases; the job limits themselves stay as they are.
- Status: open
