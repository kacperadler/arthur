# AR0074 - Core: one flag parser for the CLI, spawn and continue

```json
{
  "id": "AR0074",
  "title": "Core: one flag parser for the CLI, spawn and continue",
  "date": "2026-10-16",
  "after": [
    "AR0073"
  ]
}
```

## Description

A7 of the core line review: about 10 lines out, every usage line and refusal text unchanged; entries 16, 21 and 31 get one place for their flags.

## Goal

The core stays small enough to understand, with capability in plugins (vision); the plan is `spec/quality/core-lines-2026-10-16.md`, proposal A7.

- Kind: cleanup

## Done means

- What proposal A7 of `spec/quality/core-lines-2026-10-16.md` names, and no behaviour change: every existing test passes unchanged except where the report names a doc or test edit.
- Every usage line and refusal text is byte-identical (the existing CLI tests pass unchanged).
- `npm test` and `npm run check` pass; the core line count drops by at least the lines the report gives, and the final message states the before and after counts.

## Scope

In:
- The files proposal A7 names.

Out:
- Anything the report does not name.

## Decisions

- 2026-10-16: Coordinator: from the core line review (AR0069), accepted.
- 2026-10-16: The human: steps 1 (cuts AR0074 to AR0079) and 2 (entries 16, 21, 22) approved; in parallel only where tickets touch different files, otherwise one after another. Entry 23 starts only after both are merged.
