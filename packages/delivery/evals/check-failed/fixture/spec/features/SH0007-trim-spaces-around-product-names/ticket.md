# SH0007 - Trim spaces around product names

```json
{
  "id": "SH0007",
  "title": "Trim spaces around product names",
  "date": "2026-10-21"
}
```

## Description

A product name typed with spaces around it is stored trimmed, so the catalog lists it in its place and the search finds it.

## Goal

11 products sort first in the catalog because their name starts with a space (`npm run catalog:audit`).

- Kind: fix

## Done means

- A name is trimmed when saved and when listed; `test/catalog.test.ts` covers both.
- `npm run check` and `npm test` pass.

## Scope

In:
- `src/catalog.ts`: the trim.

Out:
- Fixing the names already stored (a one-off script).

## Decisions

- 2026-10-21: The owner approved it.
