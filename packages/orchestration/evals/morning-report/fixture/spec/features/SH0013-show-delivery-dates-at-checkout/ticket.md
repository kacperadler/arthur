# SH0013 - Show delivery dates at checkout

```json
{
  "id": "SH0013",
  "title": "Show delivery dates at checkout",
  "date": "2026-10-21"
}
```

## Description

The checkout shows when the order arrives, from the carrier's dates, before the customer pays.

## Goal

Customers ask when an order arrives (7 mails in October).

- Kind: feature

## Done means

- The checkout shows the carrier's delivery date; `test/checkout.test.ts` covers it.
- `npm run check` and `npm test` pass.

## Scope

In:
- `src/checkout.ts`: the date.
- `src/carrier.ts`: the carrier's dates.

Out:
- Tracking after the order ships.

## Decisions

- 2026-10-21: Asked for by the owner; it waits for his approval.
