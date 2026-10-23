# AR0157 - Roadmap 38: Start notice and LLM probe

```json
{
  "id": "AR0157",
  "title": "Roadmap 38: Start notice and LLM probe",
  "date": "2026-10-19",
  "after": [
    "AR0153"
  ]
}
```

## Description

Roadmap entry 38 (`spec/roadmap.md`), built as the entry says.

## Goal

When Arthur starts, the owner is told it is up, and a failing model provider is found at start instead of at the first real turn.

- Kind: feat

## Done means

- Entry 38's Delivers, Also delivers and Done means, each edge case with its test against the fake host and the fake agent.
- Each option it adds is in `arthur.config.example.ts` and the option table; each command has its doc page; the README feature table and `arthur.mmd` show the entry built.
- `npm test` and `npm run check` pass.

## Scope

Out:
- Entries after 38.

## Decisions

- 2026-10-18: The owner asked for a night plan for Arthur with Claude 7 Day usage up to 75%; entry 38 is next in order (depends on 36, merged).
- 2026-10-19: Coordinator (owner delegated Arthur calls): session 539 -> 691 (+152: start-notice.ts, turn-extension.ts, credential.ts, session.ts) accepted; every start = every arthur run start; the probe runs alongside the start, cut at a fixed 60 s; 'coordinator up' = the model answered; a failed turn reaches the channels through turn-failed/ files, older ones dropped; the credential redaction rules as listed: accepted.
