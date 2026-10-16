# AR0069 - Core line review: what moves to a plugin or goes

```json
{
  "id": "AR0069",
  "title": "Core line review: what moves to a plugin or goes",
  "date": "2026-10-16",
  "after": [
    "AR0018"
  ]
}
```

## Description

The core's line budget was set at 4000 and has been raised four times on 2026-10-16 (AR0017 to 4224, AR0066 to 4226, AR0065 to 4234, AR0018 by about 139 more). Before the next core entries (16, 21, 22) this ticket reviews all of `packages/core/src` and proposes, with line counts, what moves into a plugin or can be cut, and what budget the rest of the core really needs. A read-only review and a written proposal; nothing is cut in it.

## Goal

The core stays small enough to understand (vision: small core, capability in plugins); the budget is a decision from evidence, not a number raised one ticket at a time.

- Kind: cleanup

## Done means

- `spec/quality/core-lines-2026-10-16.md`: per file in `packages/core/src`, its lines and its job in one line; the proposals, each with the lines it saves, the entry or plugin it would move to, and its risk (a move of a contract the plugins rely on is named as such); duplicated code across files (with file:line); comments that repeat the docs.
- A recommended core budget for entries 1 to 22 with the proposals applied, and the tickets to cut them (titles and one line each), for the coordinator to create.
- `npm test` and `npm run check` pass (nothing else changes).

## Scope

In:
- `spec/quality/core-lines-2026-10-16.md`.

Out:
- Changing code; it is planned from the proposal.

## Decisions

- 2026-10-16: Coordinator: after four raises in one day, review the whole core before the next core entries.
