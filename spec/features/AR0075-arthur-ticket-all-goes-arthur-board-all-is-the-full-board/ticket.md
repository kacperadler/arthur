# AR0075 - `arthur ticket all` goes; `arthur board all` is the full board

```json
{
  "id": "AR0075",
  "title": "`arthur ticket all` goes; `arthur board all` is the full board",
  "date": "2026-10-16",
  "after": [
    "AR0074"
  ]
}
```

## Description

A6 of the core line review: about 6 lines out, with the doc and test edits it names.

## Goal

The core stays small enough to understand, with capability in plugins (vision); the plan is `spec/quality/core-lines-2026-10-16.md`, proposal A6.

- Kind: refactor

## Done means

- What proposal A6 of `spec/quality/core-lines-2026-10-16.md` names, and no behaviour change: every existing test passes unchanged except where the report names a doc or test edit.
- `npm test` and `npm run check` pass; the core line count drops by at least the lines the report gives, and the final message states the before and after counts.

## Scope

In:
- The files proposal A6 names.

Out:
- Anything the report does not name.

## Decisions

- 2026-10-16: Coordinator: from the core line review (AR0069), accepted.
- 2026-10-16: The human: steps 1 (cuts AR0074 to AR0079) and 2 (entries 16, 21, 22) approved; in parallel only where tickets touch different files, otherwise one after another. Entry 23 starts only after both are merged.
