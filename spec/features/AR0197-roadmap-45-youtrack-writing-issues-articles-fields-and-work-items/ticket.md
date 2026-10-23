# AR0197 - Roadmap 45: YouTrack writing issues, articles, fields and work items

```json
{
  "id": "AR0197",
  "title": "Roadmap 45: YouTrack writing issues, articles, fields and work items",
  "date": "2026-10-19"
}
```

## Description

This ticket builds roadmap entry 45 in `spec/roadmap.md`, in the `youtrack` plugin, and with it the finding ticket AR0194 (the coordinator's role names arthur youtrack).

## Goal

The specification is roadmap entry 45: its Package, Delivers and Done means with every edge case, plus the Goal of the finding ticket named above.

- Kind: feat
- Budget: 12

## Done means

- Everything that entry 45's Delivers and Done means list, each refusal and edge case in its own test, plus the finding ticket's Goal.
- Tests are deterministic on a 2-core CI runner: they wait for the very state they assert, never for a fixed time, and use only loopback ports chosen by the OS.
- README's table and `arthur.mmd` show 45 as built.
- `npm test` and `npm run check` pass, and the work is committed. The coordinator pushes the branch.

## Scope

In:
- `packages/youtrack`, its docs and tests;
- the smallest core hook the entry names;
- README, `arthur.mmd`;
- `test/structure.test.ts` budgets, raised only after naming what was cut first.

Out:
- anything in another plugin. Other jobs run at the same time, so the core is touched only where the entry requires it.

## Decisions

- 2026-10-19: The owner told the coordinator to run several workers at once, under the 80% usage ceiling, and to build finding tickets alongside the roadmap entry that touches the same files.
- 2026-10-19: The coordinator accepts the youtrack budget raise from 251 to 361 (7 lines cut first) and the article version as a plain argument.
