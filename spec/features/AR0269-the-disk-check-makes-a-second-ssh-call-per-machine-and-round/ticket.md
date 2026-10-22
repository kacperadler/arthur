# AR0269 - The disk check makes a second ssh call per machine and round

```json
{
  "id": "AR0269",
  "title": "The disk check makes a second ssh call per machine and round",
  "date": "2026-10-21"
}
```

## Description

with `keepFree.disk` above 0, each round of the `machines` plugin makes its one ssh call for os, arch, version, tools and the free CPU and memory (AR0149), and then the resources plugin's `df -Pk` makes a second ssh call to the same machine. `packages/resources/test/disk.test.ts`, "free space hovering …", counts one ssh call per round, the df alone.

## Goal

One ssh call per machine and round: the disk check rides on the machines plugin's probe instead of a second call, so each check costs half the connections.

- Kind: improvement

Evidence:
- `packages/resources/src/machine-disk.ts` (`measureDisk`), `packages/machines/src/machine-check.ts` (`SCRIPT`)
- Found by: 2026-10-21-ar0262-roadmap-69-disk-f-82a16dc2 (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: carry the df in the machines check's one call, as AR0149 did for `node -e`: `machines.round` would need the paths (the home and `collect("resources.disk")`) before the round starts, and its report a `disk` line the resources plugin parses with the same parser. Out: changing what is measured.
- `npm test` and `npm run check` pass.

## Scope

In:
- carry the df in the machines check's one call, as AR0149 did for `node -e`: `machines.round` would need the paths (the home and `collect("resources.disk")`) before the round starts, and its report a `disk` line the resources plugin parses with the same parser. Out: changing what is measured.

## Decisions

- 2026-10-21: Source: F1 of AR0262
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
