# SH0004 - Show the cart's total with tax

```json
{
  "id": "SH0004",
  "title": "Show the cart's total with tax",
  "date": "2026-10-21"
}
```

## Description

The cart shows its total with the tax included, as the receipt does, so a customer sees at the cart what the checkout will charge.

## Goal

No surprise at checkout: the cart shows the total before tax today (`src/cart.ts:41`).

- Kind: improvement

## Done means

- The cart's total is the receipt's: the tax of all lines added, rounded once; `test/cart.test.ts` covers a cart of several items.
- `npm run check` and `npm test` pass.

## Scope

In:
- `src/cart.ts`: the total.
- `test/cart.test.ts`: its tests.

Out:
- Showing the tax per line.

## Decisions

- 2026-10-21: The owner approved it.
