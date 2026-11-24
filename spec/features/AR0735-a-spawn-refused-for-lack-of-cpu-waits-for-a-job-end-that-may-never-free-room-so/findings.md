# AR0735 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A project agent whose spawn was refused for room is not the one told when the room is back

- Kind: feat
- Found by: 2026-11-24-worker-32983572 (worker), 2026-11-24
- Where: `packages/resources/src/room.ts:94`
- What: the `coordinator-message` that says a machine has room again names no `project`, as the ticket asks for one message to the coordinator. A project agent spawns its own project's jobs (`packages/orchestration/docs/commands/coordinator.md:97`) and gets only a `coordinator-message` whose `project` is its own (line 99 there), so after a refusal in its session the coordinator is told, not the agent. The refusal's wording says so (`the coordinator is told once <machine> has room again`). Read from the code and the doc, not run with a live agent.
- Suggestion: keep the project of each refused spawn in the machine's record (`.arthur/resources/machines/<name>.refused`) and emit the message once per project recorded, with `project`, so orchestration's inbox routes it; decide whether a project without an agent then gets one message or several.
- Status: open

## F2. A placed spawn refused for room waits for the machine placement picked, though another may get room first

- Kind: feat
- Found by: 2026-11-24-worker-32983572 (worker), 2026-11-24
- Where: `packages/resources/src/room.ts:110`, `packages/machines/src/machine-place.ts:116`
- What: the spawn check records the refusal for the one machine the job was placed on. With no room anywhere, placement picks the first open machine (`best` stays 0 when every room is 0; `test/room-placement.test.ts:96` shows the refusal on `local` with `gpu` short too). When `gpu` gets room before `local`, a spawn would be placed there and start, but nothing is recorded for `gpu`, so no message goes until `local` has room. An inference from those lines; not run.
- Suggestion: for a spawn that named no machine, record the refusal for each machine the refusal lists without room, so the first of them with room tells; the spawn check would need to know the machine was placed, which `Spawn` does not say today.
- Status: open

## F3. Delivery's hand-back refused for room still waits for a job's end

- Kind: fix
- Found by: 2026-11-24-worker-32983572 (worker), 2026-11-24
- Where: `packages/delivery/src/hand-back.ts:9`, `packages/delivery/src/hand-back.ts:70`
- What: a hand-back step (the worker's continue, the next review) refused by another plugin is kept "for the next `job-ended`, when a slot may be free". A refusal by resources for lack of CPU has the cause this ticket names: a job's end may free no room, and no job may end. The refusal is recorded and the coordinator is told when the machine has room, but delivery does not try the step again then, and the coordinator's message does not name the hand-back. Read from the code; not run.
- Suggestion: delivery tries its kept steps again on a signal that room is back (an event resources emits when it tells the coordinator), beside `job-ended`.
- Status: open

## F4. The vision's interface line for resources names neither `room-refused` nor the message on room

- Kind: docs
- Found by: 2026-11-24-worker-32983572 (worker), 2026-11-24
- Where: `spec/vision.md:151`
- What: the line lists "the `cap-reached` and `disk-low` events" as the plugin's interface. The plugin now also emits `room-refused` `{ machine }` and a `coordinator-message` when a machine that refused a job has room again (`packages/resources/docs/resources.md`, "How many jobs run", "Room again"). The vision is the owner's, so the line is left as it is.
- Suggestion: add `room-refused` and the coordinator's message on room to that line.
- Status: open
