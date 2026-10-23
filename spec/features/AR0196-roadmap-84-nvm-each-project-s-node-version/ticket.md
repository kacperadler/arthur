# AR0196 - Roadmap 84: nvm, each project's Node version

```json
{
  "id": "AR0196",
  "title": "Roadmap 84: nvm, each project's Node version",
  "date": "2026-10-19"
}
```

## Description

This ticket builds roadmap entry 84 in `spec/roadmap.md`, in the `nvm` plugin, and with it the finding ticket AR0184 (the .nvmrc arthur init writes is read by nvm).

## Goal

The specification is roadmap entry 84: its Package, Delivers and Done means with every edge case, plus the Goal of the finding ticket named above.

- Kind: feat
- Budget: 12

## Done means

- Everything that entry 84's Delivers and Done means list, each refusal and edge case in its own test, plus the finding ticket's Goal.
- Tests are deterministic on a 2-core CI runner: they wait for the very state they assert, never for a fixed time, and use only loopback ports chosen by the OS.
- README's table and `arthur.mmd` show 84 as built.
- `npm test` and `npm run check` pass, and the work is committed. The coordinator pushes the branch.

## Scope

In:
- `packages/nvm`, its docs and tests;
- the smallest core hook the entry names;
- README, `arthur.mmd`;
- `test/structure.test.ts` budgets, raised only after naming what was cut first.

Out:
- anything in another plugin. Other jobs run at the same time, so the core is touched only where the entry requires it.

## Decisions

- 2026-10-19: The owner told the coordinator to run several workers at once, under the 80% usage ceiling, and to build finding tickets alongside the roadmap entry that touches the same files.
- 2026-10-19: The coordinator allows the change in packages/projects install.ts on this branch: the install runs with the PATH the prepares before it returned, with a test. The order is not left to documentation: a config that lists nvm after projects is refused at load, with a message that says to list nvm() before projects. No fixed prepare order in the core.
- 2026-10-19: The owner decided: Arthur never installs a Node version by itself. A missing version or a missing nvm refuses the spawn, with the fix command.
