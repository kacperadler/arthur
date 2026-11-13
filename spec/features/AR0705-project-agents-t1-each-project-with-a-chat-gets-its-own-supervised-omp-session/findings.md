# AR0705 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. No test runs a project agent on a real tmux server where Unix sockets are refused

- Kind: test
- Found by: 2026-11-13-worker-fa1b7778 (worker), 2026-11-13
- Where: `packages/orchestration/test/project-agents.test.ts:1`, `packages/orchestration/test/unix-socket.ts:5`
- What: the job sandbox refuses every new Unix socket (`NO_UNIX_SOCKET`: `this host refuses a Unix socket (EACCES)`), so the 14 real-tmux tests of `coordinator.test.ts` are skipped in a job, and the project agents' tests run on the fake tmux of `test/fake-tmux.ts` instead. Roadmap 85's Done means says "a tmux socket in the test's folder"; what a real tmux does with a session named `<session>-<project>`, `-e` variables and `kill-session` of one session among several on one server is checked only against the fake's reading of tmux.
- Suggestion: one real-tmux test (skipped under `NO_UNIX_SOCKET`, as the others) that starts the coordinator and two agents on a socket in the test's folder and checks `tmux list-sessions`, each session's `show-environment ARTHUR_PROJECT` and that `arthur coordinator stop <project>` ends that session alone; written and run where sockets are allowed, so it is not added unrun.
- Status: open

## F2. Two projects can share one place when one names the main bot and the other leaves instance out

- Kind: fix
- Found by: 2026-11-13-review-714b3bf6 (review), 2026-11-13
- Where: `packages/orchestration/src/sessions.ts:34`
- What: the shared-chat refusal compares `instance` as written. `{ plugin: "telegram", instance: "main", place: "4" }` and `{ plugin: "telegram", place: "4" }` pass when the bot named `main` is also the plugin's main one, so both chats are one topic; once AR0706 routes messages, each agent hears the other's.
- Suggestion: in AR0706, which routes by `instance`, resolve both to the channel's bot (a `channel.instances`-style answer from each channel plugin, or refuse a chat that names the main bot by name) before comparing; orchestration alone cannot know which named bot is the main one.
- Status: open

## F3. One SIGTERM and SIGINT listener per supervised session

- Kind: fix
- Found by: 2026-11-13-review-714b3bf6 (review), 2026-11-13
- Where: `packages/orchestration/src/coordinator.ts:76`
- What: each `supervise` adds its own `SIGTERM` and `SIGINT` listener; with about ten sessions plus the other plugins' listeners Node prints `MaxListenersExceededWarning` in `arthur run`'s output [INFERENCE: not run].
- Suggestion: one listener for all supervisors of a run (the shared start chain already exists per `arthur run`), aborting every session's controller.
- Status: open

## F4. The vision still says an agent per project comes later

- Kind: docs
- Found by: 2026-11-13-worker-fa1b7778 (worker), 2026-11-13
- Where: `spec/vision.md:66`
- What: the orchestration row reads "Later, an agent per project with a `chat`, and the routing of that chat to it (roadmap 85 to 88)". After this branch, entry 85 is built; the line is the owner's, so the branch leaves it.
- Suggestion: the owner may say partly built (85 merged, 86 to 88 to come), or leave it until AR0708 merges.
- Status: open
