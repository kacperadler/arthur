# AR0676 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Roadmap entries 77 and 79 do not carry what the AR0527 plan adds to them

- Kind: docs
- Found by: 2026-11-10-worker-a64d878b (worker), 2026-11-10
- Where: `spec/roadmap.md`, entries 77 (web panel) and 79 (company edition); `spec/features/AR0527-plan-an-activity-log-plugin-what-each-user-and-each-agent-or-the-harness-did-one/plan.md:150-152`
- What: the approved plan's section 7 says "Existing entries that change: 77 gains the Log screen; 79 gains the read rule" (section 6: who reads which lines once a channel answers several users). This ticket's Scope In adds only 99 to 101, and its Out keeps every other wording, so 77 and 79 still say nothing of the activity log; entry 101 now says only that a Log screen in the web panel (77) is not built there.
- Suggestion: add to 77's Delivers a Log screen with `arthur log`'s filters, read through the server's commands (76), and to 79's Delivers the read rule of the plan's section 6; nothing else changes.
- Status: open

## F2. The herdr plugin is in no architecture diagram

- Kind: docs
- Found by: 2026-11-10-worker-a64d878b (worker), 2026-11-10
- Where: `arthur.mmd:44`, `docs/architecture/core-and-plugins.mmd:67`, `docs/architecture/versions.mmd:9`
- What: herdr (roadmap 115, AR0670, merged) is a first-version row of the vision's plugin table, but none of the three diagrams has a `herdr` node or names it; this ticket added only activity and uptime, as its Scope says.
- Suggestion: a `herdr` node, built, in `arthur.mmd`'s SELF or COORD subgraph with its class line in name order, and in `core-and-plugins.mmd`'s SELF subgraph and class list; `herdr` in `versions.mmd`'s `p3`.
- Status: open
