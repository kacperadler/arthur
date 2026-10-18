# AR0163 - Roadmap 40: Registered entries and arthur schedule

```json
{
  "id": "AR0163",
  "title": "Roadmap 40: Registered entries and arthur schedule",
  "date": "2026-10-19"
}
```

## Description

Roadmap entry 40 (`spec/roadmap.md`), built as the entry says.

## Goal

Plugins can register their own schedule entries, and the owner sees every entry with its next run through `arthur schedule`.

- Kind: feature

## Done means

- Entry 40's Delivers, Also delivers and Done means, each edge case with its test against the fake host and the fake agent.
- A registered entry's procedure passes the same path check as a hand-written entry without widening it to arbitrary paths (AR0158's finding F1, ticket AR0162, read it).
- Each option it adds is in `arthur.config.example.ts` and the option table; each command has its doc page; the README feature table and `arthur.mmd` show the entry built.
- `npm test` and `npm run check` pass.

## Scope

Out:
- Entries after 40.

## Decisions

- 2026-10-19: The owner asked for a night plan for Arthur with Claude 7 Day usage up to 75%; entry 40 is next after 39 merged.
- 2026-10-19: Coordinator (owner delegated Arthur calls): schedule 277 -> 497 (+220) accepted; a registered procedure is an absolute .md inside the plugin's own package folder, the config and file keep the relative rule (fixes AR0162); @arthur/core/lock exported: accepted.
