# AR0224 - Roadmap 50: Telegram phone commands and the menu

```json
{
  "id": "AR0224",
  "title": "Roadmap 50: Telegram phone commands and the menu",
  "date": "2026-10-20"
}
```

## Description

This ticket builds roadmap entry 50 in `spec/roadmap.md`: `/name text` from the phone runs the host's phone command and the reply comes back to the place it was sent from, the bot's command menu is built from the registered phone commands, and the session's start notice is sent.

## Goal

The specification is roadmap entry 50: its Delivers, Done means with every edge case, and Also delivers (`route` passes `channel` and `place`). The owner drives Arthur from the phone's command menu. Also the /board and /findings cuts AR0212 left for this entry (its Decisions, 2026-10-19).

- Kind: feat
- Budget: 10

## Done means

- Everything that entry 50's Delivers, Done means and Also delivers list, each edge case in its own test.
- The tests use a fake Bot API on an OS-chosen loopback port and never the real bot. No token-shaped literal is in the repository: `git grep -nE "[0-9]{6,12}:[A-Za-z0-9_-]{20,}"` prints nothing.
- Tests wait for the very state they assert, never for a fixed time (2-core CI).
- README's table and `arthur.mmd` show 50 as built.
- `npm test` and `npm run check` pass, and the commits are signed off. The coordinator pushes the branch.

## Scope

In:
- `packages/telegram`, its docs and tests; the core's command registry `route`, as entry 50 names it;
- README, `arthur.mmd`;
- `test/structure.test.ts` budgets, raised only after naming what was cut first.

Out:
- `packages/orchestration/src/inbox.ts`, which AR0223 changes now;
- freezing the host API (entry 51).

## Decisions

- 2026-10-20: The owner approved the plan 49, 50, 51 under the 90% usage ceiling and said to go on with Arthur as the coordinator recommends (87% used at the start).
- 2026-10-20: The owner: /board and /findings replies longer than one Telegram message stay in slices (no cut); this settles the line AR0212 left for entry 50.
- 2026-10-20: The owner: the coordinator acts on its own recommendation in Arthur and merges after PASS without asking; only strong decisions go to the owner.
