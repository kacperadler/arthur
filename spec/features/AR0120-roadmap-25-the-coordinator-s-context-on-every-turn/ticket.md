# AR0120 - Roadmap 25: the coordinator's context on every turn

```json
{
  "id": "AR0120",
  "title": "Roadmap 25: the coordinator's context on every turn",
  "date": "2026-10-18"
}
```

## Description

Roadmap entry 25 (`spec/roadmap.md`, "The coordinator's context on every turn"). Every turn the coordinator reads its role, each project's vision, the styleguide, the board digest, the time and night, and the lines other plugins add.

## Goal

The coordinator knows the current state on every turn without asking, as the predecessor's coordinator does (vision: one human directs many agents).

- Kind: feature

## Done means

- Entry 25's Delivers, Also delivers (F1 of AR0094) and Done means, each edge case with its test against the fake host and the fake agent: a project without a vision file gets a warning line; a contributing plugin that throws costs its line only, named; quiet hours across midnight.
- Each option it adds is in `arthur.config.example.ts`; each command change has its doc page.
- `npm test` and `npm run check` pass.

## Scope

In:
- The orchestration plugin: the context built each turn; `collect("coordinator.context")`; the coordinator's role read like every other role, listed by `arthur roles`.

Out:
- Job states in the context (entry 27).

## Decisions

- 2026-10-18: Proposed by the coordinator as the next orchestration entries toward the switch (owner: focus on Arthur, switch as soon as possible); waits for approval.
- 2026-10-18: The owner approved it.
- 2026-10-18: The orchestration line budget rises by 87, to 805 (worker): the context (context.ts), its OMP extension run before every turn (context-extension.ts), `arthur coordinator context`, and the coordinator's role registered with its model in `roles.model`.
