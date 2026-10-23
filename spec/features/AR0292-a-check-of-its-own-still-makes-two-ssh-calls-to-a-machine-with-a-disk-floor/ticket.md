# AR0292 - A check of its own still makes two ssh calls to a machine with a disk floor

```json
{
  "id": "AR0292",
  "title": "A check of its own still makes two ssh calls to a machine with a disk floor",
  "date": "2026-10-22"
}
```

## Description

outside a round of the `machines` plugin (a sample missing or older than twice its round's `everySeconds`, `arthur spawn` or `arthur resources` from a shell), the resources plugin's own check of a listed machine runs `node -e` over ssh (`measure`, its `host.jobs.run(name, ["node", "-e", SCRIPT])`), then, with `keepFree.disk` above 0 and no round's df, `df -Pk` in a second ssh call (`measureDisk`, from `checkSample`). Read from the lines, not counted by a run.

## Goal

A check of its own (outside a round) on a machine with a disk floor makes one ssh call too, so every check costs one connection, not only a round's.

- Kind: feat

Evidence:
- `packages/resources/src/machine-free.ts` (`checkSample`, `measure`), `packages/resources/src/machine-disk.ts` (`measureDisk`)
- Found by: 2026-10-22-ar0269-one-ssh-call-per-c337cff3 (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: run the `node -e` script and the df loop in one `sh -c` there, the free line first, and read both with the parsers there are (`measure`'s JSON, `readDisk`). Out: the round, which AR0269 already serves with one call.
- `npm test` and `npm run check` pass.

## Scope

In:
- run the `node -e` script and the df loop in one `sh -c` there, the free line first, and read both with the parsers there are (`measure`'s JSON, `readDisk`). Out: the round, which AR0269 already serves with one call.

## Decisions

- 2026-10-22: Source: F1 of AR0269
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
- 2026-10-22: Coordinator (free hand): line budget raise accepted, resources 607 to 616, for `ask` (one ssh call running node -e and df for a check of its own).
