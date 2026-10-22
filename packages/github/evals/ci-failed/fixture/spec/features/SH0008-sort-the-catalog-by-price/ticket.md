# SH0008 - Sort the catalog by price

```json
{
  "id": "SH0008",
  "title": "Sort the catalog by price",
  "date": "2026-10-21"
}
```

## Description

The catalog gets a sort by price, cheapest first, beside the sort by name.

## Goal

Customers ask for it (5 mails in October).

- Kind: improvement

## Done means

- Sorted by price, the catalog lists the cheapest first; `test/catalog.test.ts` covers it.
- `npm run check` and `npm test` pass.

## Scope

In:
- `src/catalog.ts`: the sort.

Out:
- A sort by rating.

## Decisions

- 2026-10-21: The owner approved it.
