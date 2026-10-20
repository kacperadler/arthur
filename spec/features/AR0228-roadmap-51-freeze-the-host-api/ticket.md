# AR0228 - Roadmap 51: freeze the host API

```json
{
  "id": "AR0228",
  "title": "Roadmap 51: freeze the host API",
  "date": "2026-10-20"
}
```

## Description

This ticket builds roadmap entry 51 in `spec/roadmap.md`: the host API as schedule, youtrack and telegram use it, written down in `docs/plugin-api.md`, with the published types and each plugin's `./options` export; whatever no plugin uses is removed. From here a change to the API is a decision recorded in its ticket.

## Goal

The specification is roadmap entry 51: its Delivers and Done means, AR0178 folded in (an entry's own keys beside `each`, and `roles.quick.model` in orchestration's table with a test). It includes what entries 49 and 50 added: `message-received` `parts` and `place`, `channel.send`, `message.part`, `route(text, from)` with `PhoneFrom` (`channel`, `place`, `instance`).

- Kind: improvement
- Budget: 10

## Done means

- Everything that entry 51's Delivers and Done means list, the test that lists the core's exports and fails on one the doc does not name included.
- `npm test` and `npm run check` pass with the types tightened, and the commits are signed off. The coordinator pushes the branch.
- README's table and `arthur.mmd` show 51 as built.

## Scope

In:
- `packages/core` exports and types, `docs/plugin-api.md`, each plugin's `./options` export and option table, the fake host;
- README, `arthur.mmd`;
- `test/structure.test.ts` budgets, raised only after naming what was cut first.

Out:
- new host members; any behaviour change beyond removing what no plugin uses.

## Decisions

- 2026-10-20: Started by the coordinator under the owner's free hand in Arthur and the 90% usage ceiling (88% used), next in the approved order after 50.
- 2026-10-20: The coordinator raised the budget to $12 after the first run ran out at $10.03 with 41 files uncommitted and npm test passing (778).
