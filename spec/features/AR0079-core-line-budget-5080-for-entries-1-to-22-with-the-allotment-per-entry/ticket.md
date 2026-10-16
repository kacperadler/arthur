# AR0079 - Core line budget 5080 for entries 1 to 22, with the allotment per entry

```json
{
  "id": "AR0079",
  "title": "Core line budget 5080 for entries 1 to 22, with the allotment per entry",
  "date": "2026-10-16",
  "after": [
    "AR0074",
    "AR0075",
    "AR0076",
    "AR0077",
    "AR0078"
  ]
}
```

## Description

Proposal 8 of the core line review: the budget set once in `test/structure.test.ts`, its comment listing the allotment (16: 250, 21: 350, 22: 200, open bug tickets: 95), and the test kit (`testing.ts`, `fake-agent.ts`) on a line budget of its own.

## Goal

The core stays small enough to understand, with capability in plugins (vision); the plan is `spec/quality/core-lines-2026-10-16.md`, proposal 8.

- Kind: cleanup

## Done means

- What proposal 8 of `spec/quality/core-lines-2026-10-16.md` names, and no behaviour change: every existing test passes unchanged except where the report names a doc or test edit.
- `npm test` and `npm run check` pass.

## Scope

In:
- The files proposal 8 names.

Out:
- Anything the report does not name.

## Decisions

- 2026-10-16: Coordinator: from the core line review (AR0069), accepted.
