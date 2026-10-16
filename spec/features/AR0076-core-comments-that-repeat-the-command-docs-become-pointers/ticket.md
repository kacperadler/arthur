# AR0076 - Core comments that repeat the command docs become pointers

```json
{
  "id": "AR0076",
  "title": "Core comments that repeat the command docs become pointers",
  "date": "2026-10-16",
  "after": [
    "AR0074"
  ]
}
```

## Description

C1 of the core line review: about 66 to 73 lines out, by the table in the report; a comment that states a contract the docs do not hold stays.

## Goal

The core stays small enough to understand, with capability in plugins (vision); the plan is `spec/quality/core-lines-2026-10-16.md`, proposal C1.

- Kind: cleanup

## Done means

- What proposal C1 of `spec/quality/core-lines-2026-10-16.md` names, and no behaviour change: every existing test passes unchanged except where the report names a doc or test edit.
- `npm test` and `npm run check` pass; the core line count drops by at least the lines the report gives, and the final message states the before and after counts.

## Scope

In:
- The files proposal C1 names.

Out:
- Anything the report does not name.

## Decisions

- 2026-10-16: Coordinator: from the core line review (AR0069), accepted.
