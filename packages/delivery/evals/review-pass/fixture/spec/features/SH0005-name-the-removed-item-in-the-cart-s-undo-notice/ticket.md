# SH0005 - Name the removed item in the cart's undo notice

```json
{
  "id": "SH0005",
  "title": "Name the removed item in the cart's undo notice",
  "date": "2026-10-21"
}
```

## Description

Removing an item from the cart shows a notice with Undo; it names the item, so a customer who removed the wrong one sees it.

## Goal

Fewer support mails about items that vanished from a cart (3 last week).

- Kind: improvement

## Done means

- The notice reads `Removed <name> from your cart. Undo`; `test/cart.test.ts` covers one item and the last one.
- `npm run check` and `npm test` pass.

## Scope

In:
- `src/cart-notice.ts`: the wording.

Out:
- Undo of several removals.

## Decisions

- 2026-10-21: The owner approved it.
