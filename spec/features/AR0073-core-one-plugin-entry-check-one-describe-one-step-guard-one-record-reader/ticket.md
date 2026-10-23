# AR0073 - Core: one plugin-entry check, one describe, one step guard, one record reader

```json
{
  "id": "AR0073",
  "title": "Core: one plugin-entry check, one describe, one step guard, one record reader",
  "date": "2026-10-16",
  "after": [
    "AR0068"
  ]
}
```

## Description

A1 to A5 of the core line review: about 38 lines out of the core, and `arthur config check` stops printing one refusal twice (F1 of AR0069, AR0072 folded in).

## Goal

The core stays small enough to understand, with capability in plugins (vision); the plan is `spec/quality/core-lines-2026-10-16.md`, proposal A1-A5.

- Kind: refactor

## Done means

- What proposal A1-A5 of `spec/quality/core-lines-2026-10-16.md` names, and no behaviour change: every existing test passes unchanged except where the report names a doc or test edit.
- `arthur config check` prints each refusal once; a test pins it.
- `npm test` and `npm run check` pass; the core line count drops by at least the lines the report gives, and the final message states the before and after counts.

## Scope

In:
- The files proposal A1-A5 names.

Out:
- Anything the report does not name.

## Decisions

- 2026-10-16: Coordinator: from the core line review (AR0069), accepted.
- 2026-10-16: The human: finish the work already started (AR0073), then pause Arthur; no new AR ticket starts until he says so.
- 2026-10-16: Coordinator: 33 lines out (4372 -> 4339) is accepted; the report said "about 38" and A4 cannot save lines (the old reader was one line). Nothing outside A1 to A5 is cut here; C1 has its own ticket.
