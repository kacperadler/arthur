# AR0294 - An eval turn's plugin context lines are the live Arthur's, which a scenario cannot set

```json
{
  "id": "AR0294",
  "title": "An eval turn's plugin context lines are the live Arthur's, which a scenario cannot set",
  "date": "2026-10-22"
}
```

## Description

`coordinator.checkoutContext` adds each plugin's context lines as the live plugins answer them now: the session plugin's `Restart:` line reads the live restart guard, manage's retro line the main checkout, projects the live list. A scenario cannot say "a restart is due" (session's `after-restart-plan` and `unblocked-after-restart` keep a `needs` line for it), and a live `Restart: due` while Arthur's code changed under a running `arthur run` reaches every scenario's turn, so a rate can move with the machine's state, not the roles.

## Goal

A scenario can set the plugin context lines its eval turn gets, instead of inheriting the live Arthur's, so a run measures the fixture and not the machine it runs on.

- Kind: security

Evidence:
- `packages/orchestration/src/context.ts:71` (`collectEach("coordinator.context")` with no argument)
- Found by: 2026-10-22-ar0279-ba46bace (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: a scenario `context` of `{ <plugin>: <text> }` that replaces that plugin's answer in the eval (orchestration taking it in `coordinator.checkoutContext`), and a plugin left out answering nothing in an eval; then the session scenarios set their `Restart:` line and drop their `needs`.
- `npm test` and `npm run check` pass.

## Scope

In:
- a scenario `context` of `{ <plugin>: <text> }` that replaces that plugin's answer in the eval (orchestration taking it in `coordinator.checkoutContext`), and a plugin left out answering nothing in an eval; then the session scenarios set their `Restart:` line and drop their `needs`.

## Decisions

- 2026-10-22: Source: F1 of AR0279
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
- 2026-10-22: Coordinator (free hand): line budget raise accepted, orchestration 2278 to 2284, develop 668 to 670, for a scenario's `context` replacing each plugin's eval lines and its checks.
- 2026-10-22: Coordinator (free hand): after merging main (AR0295), orchestration 2285 (2278 + 6 + 1 for the merged checkout comment), develop 670.
