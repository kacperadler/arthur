# AR0277 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The eval still words a schedule entry with its own copy of the schedule plugin's `[scheduled <id>]` line

- Kind: risk
- Found by: 2026-10-22-ar0277-eval-turn-wording-9459b77a (worker), 2026-10-22
- Where: `packages/develop/src/eval-scenario.ts` (`turnText`, the `coordinator-message` text), copying `packages/schedule/src/sweep.ts:39`
- What: since AR0277 the eval asks orchestration for the turn (`coordinator.turn`), so the `[Arthur]` mark, the wake and the closing line follow orchestration. The text of a schedule entry's `coordinator-message`, `[scheduled <id>] <message>` with its procedure under a blank line, is still built by develop: a change of that wording in the schedule plugin leaves `{ scheduled, ... }` scenarios replaying the old text, and nothing fails.
- Suggestion: the schedule plugin provides the text of an action due (say `schedule.message`, answering `(id, message, procedure text)`), which develop asks instead of its copy; the sweep itself and its late mark stay out.
- Status: ticket AR0289

## F2. The telegram menu test failed once in a full `npm test` and passes alone

- Kind: bug
- Found by: 2026-10-22-ar0277-eval-turn-wording-9459b77a (worker), 2026-10-22
- Where: `packages/telegram/test/commands.test.ts:119` ("the menu is the phone commands, set at a start only when they changed since the last one set, per bot")
- What: one full `npm test` on this branch (986 tests) failed this test alone, in 37 ms; the branch touches no telegram file. Run alone it passed 7/7, and six copies of the file run at once all passed (`node --import @arthur/core/testing --test packages/telegram/test/commands.test.ts`). The failure's message was not kept. [INFERENCE] a start is stopped once the fake Bot API has seen the menu call and a poll, which may be before the plugin wrote `menu.json`, so the next start sets the menu again and the count assertion fails under load.
- Suggestion: make each start in the test wait for the very state it asserts next (the record written, not only the API call seen); reproduce first under load (the full suite) to get the message.
- Status: ticket AR0290
