# SH0004 - Review 4

- Job: 2026-10-22-review-2c3d4e5f
- Branch: arthur/2026-10-22-worker-7b2e4d11
- Commit reviewed: 8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c
- Verdict: FAIL

## Final message

The total now rounds once, but half a cent rounds down where the receipt rounds it up, so a cart of 0.125 of tax shows 0.12 (src/cart.ts:44).

**Findings**

1. `src/cart.ts:44`: round half up, as `src/receipt.ts:20` does; Done means asks for the receipt's total.

**Checks I ran**

- `npm test`: 51/51.

FAIL
