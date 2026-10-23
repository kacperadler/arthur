# AR0346 - A copy from another machine writes a file under the name the answer gives, which may be a path

```json
{
  "id": "AR0346",
  "title": "A copy from another machine writes a file under the name the answer gives, which may be a path",
  "date": "2026-10-23"
}
```

## Description

the rule: a copied file lands only in that job's record, `<home>/jobs/<id>/`. The check missing: the key of `files` in the `arthur remote-job records` answer is passed to `write(folder, name, text)` as it came, and `write` joins it to the folder; a name with path segments resolves elsewhere (`node -e` on `path.join`: `sub/../../<other-id>/branch` resolves to another job's record, `x/../../../tmp/y` outside `jobs/`), so the answer of a machine decides the path and the content of a file written as Arthur's user here, with nothing but the user's permissions as the bound. A name containing `.lock` or starting with `.` is not refused either, though `records` there never sends one (`remote-job.ts:102`). Confirms AR0311's F3 (`:62`). The precondition is a machine whose record folder is not this Arthur's: a job there that writes its own record beside its worktree, or a machine that is not what it was.

## Goal

A file copied back from another machine is written only under a plain record key in that job's own record; any other name is refused; tested.

- Kind: risk

Evidence:
- `packages/core/src/machine-sync.ts:62`, `packages/core/src/job-state.ts:91-93`
- Found by: 2026-10-23-ar0321-security-check-c2599b95 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: at `machine-sync.ts:62`, refuse a key that is not a plain record key (one segment, no `/`, not starting with `.`, no `.lock`; the keys `writeRecord` and the wrapper write are `[a-z][a-z0-9-]*`), naming the machine and the key in the error, so nothing of that answer is written; with F2, the allow-list makes this the second check, not the only one. Tests, in `machine.test.ts` with the fake `ssh` answering a `records` JSON by hand: a `files` key with `/`, with `..` and one ending `.lock` leave every file outside the record as it was, and the copy is refused naming the key; a plain key is still written. Out: the `log` key, which stays its own branch of the code.
- `npm test` and `npm run check` pass.

## Scope

In:
- at `machine-sync.ts:62`, refuse a key that is not a plain record key (one segment, no `/`, not starting with `.`, no `.lock`; the keys `writeRecord` and the wrapper write are `[a-z][a-z0-9-]*`), naming the machine and the key in the error, so nothing of that answer is written; with F2, the allow-list makes this the second check, not the only one. Tests, in `machine.test.ts` with the fake `ssh` answering a `records` JSON by hand: a `files` key with `/`, with `..` and one ending `.lock` leave every file outside the record as it was, and the copy is refused naming the key; a plain key is still written. Out: the `log` key, which stays its own branch of the code.

## Decisions

- 2026-10-23: Source: F1 of AR0321
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
- 2026-10-23: The owner: weekly cap raised to 40%; fixes one at a time to avoid conflicts, criticals first (AR0329, AR0346), then highs (AR0330, AR0331, AR0347, AR0349, AR0353, AR0370).
