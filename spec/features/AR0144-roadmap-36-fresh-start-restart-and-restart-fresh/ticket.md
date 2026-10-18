# AR0144 - Roadmap 36: Fresh start, /restart and /restart fresh

```json
{
  "id": "AR0144",
  "title": "Roadmap 36: Fresh start, /restart and /restart fresh",
  "date": "2026-10-18",
  "after": [
    "AR0143"
  ]
}
```

## Description

Roadmap entry 36 (`spec/roadmap.md`), built as the entry says.

## Goal

The coordinator starts a fresh conversation at a set time or on /restart, only once no job runs.

- Kind: feature

## Done means

- Entry 36's Delivers, Also delivers and Done means, each edge case with its test against the fake host and the fake agent.
- Each option it adds is in `arthur.config.example.ts` and the option table; each command has its doc page; the README feature table and `arthur.mmd` show the entry built.
- `npm test` and `npm run check` pass.

## Scope

Out:
- Restart guard (entry 37).

## Decisions

- 2026-10-18: The owner: build the roadmap in its order; on 2026-10-18 evening he asked for a night plan for Arthur with Claude 7 Day usage up to 75%. This entry is in that plan.
