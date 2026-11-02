# SH0004 - Review 3

- Job: 2026-10-22-review-6a7b8c9d
- Branch: arthur/2026-10-22-worker-7b2e4d11
- Commit reviewed: 7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f
- Verdict: FAIL

## Final message

The new test covers three items, but it rounds the expected total by hand the way the code does, so it passes on the old per-line rounding too (test/cart.test.ts:58).

**Findings**

1. `test/cart.test.ts:58`: take the expected total from the receipt (`src/receipt.ts`), not from the cart's own rounding.

**Checks I ran**

- `npm test`: 50/50.

FAIL
