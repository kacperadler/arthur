# SH0004 - Review 1

- Job: 2026-10-22-review-9a8c7e61
- Branch: arthur/2026-10-22-worker-7b2e4d11
- Commit reviewed: 2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a
- Verdict: FAIL

## Final message

The total adds the tax per line and rounds each line, so a cart of three 0.10 items shows 0.33 where the receipt shows 0.32 (src/cart.ts:41).

**Findings**

1. `src/cart.ts:41`: round the total once, after the tax of all lines is added; Done means asks for the receipt's total.
2. `test/cart.test.ts`: no test covers a cart of several items with tax.

**Checks I ran**

- `npm test`: 49/49, none of them on several items.

FAIL
