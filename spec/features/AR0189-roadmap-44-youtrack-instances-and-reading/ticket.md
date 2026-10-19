# AR0189 - Roadmap 44: YouTrack instances and reading

```json
{
  "id": "AR0189",
  "title": "Roadmap 44: YouTrack instances and reading",
  "date": "2026-10-19"
}
```

## Description

This ticket builds roadmap entry 44 in `spec/roadmap.md`, the `youtrack` plugin.

## Goal

The specification is roadmap entry 44: its Package, Delivers and Done means with every edge case. Built in parallel with other entries, it stays inside its own plugin package wherever it can.

- Kind: improvement
- Budget: 12

## Done means

- Everything that entry 44's Delivers and Done means list, each refusal and edge case in its own test.
- Tests are deterministic on a 2-core CI runner: they wait for the very state they assert, never for a fixed time, and use only loopback ports chosen by the OS.
- README's table and `arthur.mmd` show 44 as built.
- `npm test` and `npm run check` pass, the branch is pushed, and GitHub `ci` is green on its tip.

## Scope

In:
- `packages/youtrack`, its docs and tests;
- the smallest core hook the entry names;
- README, `arthur.mmd`;
- `test/structure.test.ts` budgets, raised only after naming what was cut first.

Out: anything in another plugin. Another job (AR0187) is changing the core's spawn and roles files at the same time, so the core is touched only where the entry requires it.

## Decisions

- 2026-10-19: The owner told the coordinator to run several workers at once ("lec"), under the 80% usage ceiling.
