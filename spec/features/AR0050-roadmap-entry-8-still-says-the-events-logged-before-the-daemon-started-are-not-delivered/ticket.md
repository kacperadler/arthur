# AR0050 - Roadmap entry 8 still says the events logged before the daemon started are not delivered

```json
{
  "id": "AR0050",
  "title": "Roadmap entry 8 still says the events logged before the daemon started are not delivered",
  "date": "2026-10-16"
}
```

## Description

entry 8's Done means lists as edge cases "events logged before the daemon started are not delivered" and "no event from another process reaches a plugin once the stops begin". Since AR0044, `arthur run` delivers at its start every event after the number kept in `<home>/events.delivered` (only a first start begins at the log's end), and a plugin that emits during its stop gets the events appended before that one first, so the log's order and the kept number hold (`packages/core/docs/commands/run.md`).

## Goal

The roadmap says what the code does: entry 8's edge cases match the replay AR0044 built.

- Model: haiku
- Kind: refactor

Evidence:
- `spec/roadmap.md:85`
- Found by: 2026-10-16-ar0044-events-replay-aft-8791d5a8 (worker), 2026-10-16

## Done means

- `spec/roadmap.md` entry 8, Done means: replace "events logged before the daemon started are not delivered" with "a first start begins at the log's end; a later start delivers every event after the kept number (AR0044)", and replace "no event from another process reaches a plugin once the stops begin" with "a plugin that emits during its stop gets the events appended before its own first, so the log's order and the kept number hold". Nothing else.
- `npm test` and `npm run check` pass.

## Scope

In:
- `spec/roadmap.md` entry 8.

## Decisions

- 2026-10-16: Source: F1 of AR0044
