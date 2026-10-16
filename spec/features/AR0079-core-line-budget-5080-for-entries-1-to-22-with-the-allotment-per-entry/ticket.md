# AR0079 - Core line budget 5080 for entries 1 to 22, with the allotment per entry

```json
{
  "id": "AR0079",
  "title": "Core line budget 5080 for entries 1 to 22, with the allotment per entry",
  "date": "2026-10-16",
  "after": [
    "AR0076"
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
- 2026-10-16: The human: steps 1 (cuts AR0074 to AR0079) and 2 (entries 16, 21, 22) approved; in parallel only where tickets touch different files, otherwise one after another. Entry 23 starts only after both are merged.
- 2026-10-16: The human: AR0070, AR0071, AR0076 and AR0079 run today, one after another (shared files); then Arthur pauses.
