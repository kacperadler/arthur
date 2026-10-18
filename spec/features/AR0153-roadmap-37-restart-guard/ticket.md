# AR0153 - Roadmap 37: Restart guard

```json
{
  "id": "AR0153",
  "title": "Roadmap 37: Restart guard",
  "date": "2026-10-18"
}
```

## Description

Roadmap entry 37 (`spec/roadmap.md`), built as the entry says.

## Goal

After a merge that changed code the running session loaded, Arthur says a restart is due and holds new jobs until it happens, so nobody runs on stale code unknowingly.

- Kind: feature

## Done means

- Entry 37's Delivers, Also delivers and Done means, each edge case with its test against the fake host and the fake agent.
- Each option it adds is in `arthur.config.example.ts` and the option table; each command has its doc page; the README feature table and `arthur.mmd` show the entry built.
- `npm test` and `npm run check` pass.

## Scope

Out:
- Start notice and LLM probe (entry 38).

## Decisions

- 2026-10-18: The owner asked for a night plan for Arthur with Claude 7 Day usage up to 75%; entry 37 is next in order after 36 merged.
- 2026-10-18: Coordinator (owner delegated Arthur calls): core 4852 -> 4859 (+7, host.code) and session 453 -> 539 (+86, restart-guard.ts) accepted; only a restart of arthur run clears a due restart (a /restart that cleared it would claim new code while plugins run old code): accepted; whether /restart should end arthur run while a restart is due stays F1 for the owner; the line under ## session instead of ## Restart accepted.
