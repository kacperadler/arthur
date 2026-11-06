# AR0528 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Typed terminal input: omp has a `before_agent_start` event

- Kind: feat
- Found by: 2026-11-06-worker-8dfeac5d (worker), 2026-11-06
- Where: `packages/orchestration/src/inbox-extension.ts:20`
- What: the plan (AR0527, Not available directly) asked entry 99 to check for an omp hook on typed input. The omp 18.3.0 binary holds an extension event `before_agent_start`, `{ type: "before_agent_start", prompt, images }`, fired before each agent run: `strings -n 8 ~/.local/bin/omp | grep before_agent_start`. It also fires for the inbox's own hand-overs, so a typed prompt would be told apart by not being one of them. It is not in omp's published docs as far as seen, so it is an unconfirmed API.
- Suggestion: plan Option 2: orchestration's inbox extension handles `before_agent_start` and, for a prompt that is no hand-over, emits `message-received { channel: "terminal" }` (about 20 lines). Until then, Option 1 holds: the coordinator's actions on a word typed in `arthur attach` carry `on: []`.
- Status: deferred (client summary)

## F2. Events a plugin emits in its `stop` pull other processes' events into stopped plugins

- Kind: fix
- Found by: 2026-11-06-worker-8dfeac5d (worker), 2026-11-06
- Where: `packages/core/src/events.ts:74`
- What: `arthur run` unfollows the log before the stops, but `emit` still catches up on what other processes appended and delivers it at once, to every handler, those of plugins already stopped included, and counts it delivered. A plugin that emits in its `stop` (or anything emitted after it) so delivers other processes' events to stopped plugins, and the next start never replays them. Seen while building `command-ran`: emitted on the bus after `run` returned, it delivered a command's `pinged` to the stopped test plugin (`packages/core/test/run.test.ts`, the daemon test); this branch logs `command-ran` without delivering it, so it no longer does.
- Suggestion: after the stop of `follow`, `emit` appends and delivers only its own event in this process, without catching up or keeping the number; the next start replays the rest. Needs a check of what each plugin's `stop` emits.
- Status: deferred (client summary)
