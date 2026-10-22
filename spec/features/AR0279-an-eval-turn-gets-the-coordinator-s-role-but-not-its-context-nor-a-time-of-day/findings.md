# AR0279 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

## F1. An eval turn's plugin context lines are the live Arthur's, which a scenario cannot set

- Kind: risk
- Found by: 2026-10-22-ar0279-ba46bace (worker), 2026-10-22
- Where: `packages/orchestration/src/context.ts:71` (`collectEach("coordinator.context")` with no argument)
- What: `coordinator.checkoutContext` adds each plugin's context lines as the live plugins answer them now: the session plugin's `Restart:` line reads the live restart guard, manage's retro line the main checkout, projects the live list. A scenario cannot say "a restart is due" (session's `after-restart-plan` and `unblocked-after-restart` keep a `needs` line for it), and a live `Restart: due` while Arthur's code changed under a running `arthur run` reaches every scenario's turn, so a rate can move with the machine's state, not the roles.
- Suggestion: a scenario `context` of `{ <plugin>: <text> }` that replaces that plugin's answer in the eval (orchestration taking it in `coordinator.checkoutContext`), and a plugin left out answering nothing in an eval; then the session scenarios set their `Restart:` line and drop their `needs`.
- Status: ticket AR0294

## F2. The fixtures have no vision, so every eval context warns the main project has none

- Kind: improvement
- Found by: 2026-10-22-ar0279-ba46bace (worker), 2026-10-22
- Where: `packages/*/evals/*/fixture/` (no `spec/vision.md`)
- What: the context of a fixture's copy reads the vision at the main project's `prompts.vision` in the copy; no fixture has one, so each turn's context says `- project arthur has no vision: spec/vision.md is missing; the coordinator goes without it` (seen in a smoke run of `orchestration/night-one-line` and `orchestration/morning-report`), naming the main project while the fixture is the shop, which the live coordinator never sees.
- Suggestion: a short `spec/vision.md` of the shop in each fixture (or one the runner copies in when the fixture has none); the heading then names the main project, `## Vision of arthur`, which could name nothing for a checkout.
- Status: ticket AR0295
