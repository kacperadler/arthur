# AR0348 - The answer of `records` is not checked, and one job's bad answer stops the copy of the machine's other jobs

```json
{
  "id": "AR0348",
  "title": "The answer of `records` is not checked, and one job's bad answer stops the copy of the machine's other jobs",
  "date": "2026-10-23"
}
```

## Description

the rule: a copy moves the job here as there, and a failure of one copy leaves the others alone (`spawn.md:61`, "the other machines still copy"). The check missing: the parsed JSON is cast to `Record<string, Copy>` (`:56`) and read as typed: `copy.state` of any text is written as the job's state (`:71-77`; `moveJob` checks `to` against nothing), and counts as an end (`:66`) with a `job-ended` of that state; `copy.since` that is no date throws `RangeError` in `toISOString` under the record's lock (`:77`, `job-state.ts:69`); `copy.files` that is no object of strings throws in `write`; and any throw at `:62-79` leaves the `for` of `:57`, so the machine's other jobs are not copied that sweep, and not on any sweep while the record there stays so (`syncMachines` isolates machines, `:38-44`, not jobs). This is the availability side of the own-record rule: one job's record there decides whether the machine's other jobs move here.

## Goal

The `records` answer is checked for its shape, and one job's bad answer is reported without stopping the copy of the machine's other jobs; tested.

- Kind: risk

Evidence:
- `packages/core/src/machine-sync.ts:56-80`
- Found by: 2026-10-23-ar0321-security-check-c2599b95 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: check `copy` before anything is written (`state` in `STATES`, `since` parses, `at`, `logFrom`, `logSize` finite numbers, `files` an object whose values are strings), and copy each job in its own try, gathering the failures naming the job as `syncMachines` gathers machines, so the other jobs of the machine still move. Tests: an answer with a bad `since` for one job still copies the other job of that machine, and the sweep's error names the first; a `state` outside `STATES` is refused and the record's state is unchanged.
- `npm test` and `npm run check` pass.

## Scope

In:
- check `copy` before anything is written (`state` in `STATES`, `since` parses, `at`, `logFrom`, `logSize` finite numbers, `files` an object whose values are strings), and copy each job in its own try, gathering the failures naming the job as `syncMachines` gathers machines, so the other jobs of the machine still move. Tests: an answer with a bad `since` for one job still copies the other job of that machine, and the sweep's error names the first; a `state` outside `STATES` is refused and the record's state is unchanged.

## Decisions

- 2026-10-23: Source: F3 of AR0321
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
