# SH0006 - Count the items per order in the sales report

```json
{
  "id": "SH0006",
  "title": "Count the items per order in the sales report",
  "date": "2026-10-21"
}
```

## Description

The sales report gets an Items column: how many items each order holds, so the owner sees the size of orders, not only their value.

## Goal

The owner counts items by hand each month from the order export.

- Kind: improvement

## Done means

- The report's Items column is the sum of each order's quantities; `test/report.test.ts` covers an order of one line and of several.
- `npm run check` and `npm test` pass.

## Scope

In:
- `src/report.ts`: the column.
- `test/report.test.ts`: its tests.

Out:
- Charts of order sizes.

## Decisions

- 2026-10-21: The owner approved it.
