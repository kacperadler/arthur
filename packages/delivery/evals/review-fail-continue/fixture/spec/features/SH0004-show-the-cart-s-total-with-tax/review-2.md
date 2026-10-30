# SH0004 - Review 2

- Job: 2026-10-22-review-4e5f6a7b
- Branch: arthur/2026-10-22-worker-7b2e4d11
- Commit reviewed: 5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d
- Verdict: FAIL

## Final message

The total now adds the tax of all lines before it rounds, but `test/cart.test.ts` still covers one item only, so nothing holds the fix for several items.

**Findings**

1. `test/cart.test.ts`: no test covers a cart of several items with tax; Done means asks for one.

**Checks I ran**

- `npm test`: 49/49.

FAIL
