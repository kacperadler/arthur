# AR0275 - Roadmap 65: the morning report

```json
{
  "id": "AR0275",
  "title": "Roadmap 65: the morning report",
  "date": "2026-10-22"
}
```

## Description

This ticket builds roadmap entry 65 in `spec/roadmap.md` in the `orchestration` plugin.

## Goal

The specification is roadmap entry 65: its Delivers and Done means.

- Kind: feat
- Budget: 10

## Done means

- Everything entry 65's Delivers and Done means list, each edge case with its test: a night with nothing done says so in one line; `morningReport.at` with schedule disabled or not loaded is refused at load, naming the option; with schedule loaded the action is registered through `schedule.register`.
- The report's procedure carries the role file's rule: every ticket, finding, job or project it names gets a plain sentence on what it is and what the owner will see change, never an id alone; every waiting decision is a self-contained question with options and a recommendation; this outranks any length limit.
- Each of the five sections (built overnight, merged without the owner, waiting for approval, waiting for a decision, needs attention from health) is left out when empty, each with its test.
- The option is in `arthur.config.example.ts` and in orchestration's option table.
- Only the published host API of `docs/plugin-api.md`; any new host member is recorded there under "Changes since entry 51".
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 65 as built.

## Scope

In:
- `packages/orchestration`, its roles and docs, tests, `arthur.config.example.ts`, README, `arthur.mmd`, `test/structure.test.ts`.

## Decisions

- 2026-10-22: Started by the coordinator; owner: continue Arthur today up to 20% of the weekly limit (8% at 08:40).
- 2026-10-22: Coordinator (free hand) accepted the worker pick: under silent mode the coordinator runs `arthur silent ask` before replying, so the morning report still reaches the owner.
