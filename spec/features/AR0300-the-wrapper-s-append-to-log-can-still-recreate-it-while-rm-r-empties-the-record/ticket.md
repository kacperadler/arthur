# AR0300 - The wrapper's append to log can still recreate it while rm -r empties the record

```json
{
  "id": "AR0300",
  "title": "The wrapper's append to log can still recreate it while rm -r empties the record",
  "date": "2026-10-22"
}
```

## Description

AR0202 ends the wrapper at the first failed use once the record's `pid` is gone, but an append to `log` does not fail: `appendFileSync` recreates `log` in the folder `rm -r` is emptying, so that `rm -r` can fail with `ENOTEMPTY` before the wrapper's next failing use ends it. [INFERENCE: read from the lines; not reproduced.]

## Goal

Removing a job's record with `rm -r` while its wrapper runs always succeeds: the wrapper never recreates `log` in a record that is being removed.

- Kind: bug

Evidence:
- `packages/core/src/wrapper.ts` (`save` with `append`, `appendFileSync(join(folder, name), text)`)
- Suggestion: before appending, end the wrapper when `pid` is gone (`gone()`), or append with a flag that does not create the file; out: any retry of the use.
- Found by: 2026-10-19-ar0190-models-jobs-batch-f89d6b5b (worker), 2026-10-19

## Done means

- A test removes a running wrapper's record while it appends to `log`; the record is gone and the wrapper ends with its one line, never `ENOTEMPTY`.
- `npm test` and `npm run check` pass. The structure test holds.

## Scope

In:
- `packages/core/src/wrapper.ts`: the append to `log`.

Out:
- Any retry of a failed use.

## Decisions

- 2026-10-22: Source: F1 of AR0202
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
- 2026-10-22: Coordinator (free hand): line budget raise accepted, core 5753 to 5755, for creating `log` once and treating a missing `log` as removal in `wrapper.ts`.
- 2026-10-22: Coordinator (free hand): option (a): the other record files keep write-to-temp-and-rename (styleguide); a removal racing their rename is a known limit, written in `spawn.md`. Scope stays `log`.
