# AR0139 - `resources.free` answer shape fixed here for entry 34

```json
{
  "id": "AR0139",
  "title": "`resources.free` answer shape fixed here for entry 34",
  "date": "2026-10-18"
}
```

## Description

entry 31 reads "the most room from `call("resources.free")`" without its shape. Placement calls it once per candidate machine with the machine's name and reads the answer (or its promise) as a number: the jobs that machine has room for, the most winning. Entry 34 must provide exactly that, or placement silently compares `NaN` and falls back to `local` and the list's order.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: feat

Evidence:
- `packages/machines/src/machine-place.ts` (`placement`), `packages/machines/docs/commands/machines.md` ("Placing a job"), roadmap entry 34
- Found by: 2026-10-18-ar0125-machine-placement-7dd32646 (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: entry 34 provides `resources.free(machine) -> number` as documented, and its test spawns through the machines plugin's placement on the fake host to prove the two agree.
- `npm test` and `npm run check` pass.

## Scope

In:
- entry 34 provides `resources.free(machine) -> number` as documented, and its test spawns through the machines plugin's placement on the fake host to prove the two agree.

## Decisions

- 2026-10-18: Source: F2 of AR0125
