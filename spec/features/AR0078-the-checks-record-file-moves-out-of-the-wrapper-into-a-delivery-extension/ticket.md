# AR0078 - The checks record file moves out of the wrapper into a delivery extension

```json
{
  "id": "AR0078",
  "title": "The checks record file moves out of the wrapper into a delivery extension",
  "date": "2026-10-16",
  "after": [
    "AR0077",
    "AR0074"
  ]
}
```

## Description

B2 of the core line review: about 52 lines out now; roadmap 11 and 53, `spawn.md` and `continue.md` edited; `host.jobs.registerExtension` lands with entry 53.

## Goal

The core stays small enough to understand, with capability in plugins (vision); the plan is `spec/quality/core-lines-2026-10-16.md`, proposal B2.

- Kind: refactor

## Done means

- What proposal B2 of `spec/quality/core-lines-2026-10-16.md` names, and no behaviour change: every existing test passes unchanged except where the report names a doc or test edit.
- `npm test` and `npm run check` pass; the core line count drops by at least the lines the report gives, and the final message states the before and after counts.

## Scope

In:
- The files proposal B2 names.

Out:
- Anything the report does not name.

## Decisions

- 2026-10-16: Coordinator: from the core line review (AR0069), accepted.
- 2026-10-16: The human: steps 1 (cuts AR0074 to AR0079) and 2 (entries 16, 21, 22) approved; in parallel only where tickets touch different files, otherwise one after another. Entry 23 starts only after both are merged.
- 2026-10-16: Coordinator: accepted: one-word edits in job-scope.ts and wrapper.ts (no checks file written or described), and name/failed dropped from the tool-end event since nothing reads them.
