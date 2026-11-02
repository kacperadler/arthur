# SH0006 - Review 1

- Job: 2026-10-22-review-2b3c4d5e
- Branch: arthur/2026-10-22-worker-8e9f0a1b
- Commit reviewed: 6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d
- Verdict: PASS

## Final message

The sales report has an Items column, the sum of each order's quantities, as Done means asks; test/report.test.ts covers an order of one line and of several.

**Findings**

None.

## Notes

- (minor) `src/report.ts:88`: The count reads each order's items twice. Once for the total and once for the column; one pass would do.
- (risk) `test/report.test.ts:140`: No test covers an order with no items. The report shows such an order as 0, and no test holds that.

**Checks I ran**

- `npm run check`: clean. `npm test`: 52/52.

PASS
