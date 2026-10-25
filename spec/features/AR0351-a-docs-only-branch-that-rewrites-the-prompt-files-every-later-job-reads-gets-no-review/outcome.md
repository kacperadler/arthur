# AR0351 - Outcome

- Merged: 2026-10-25, `57f325fd`
- Branch: arthur/2026-10-25-worker-0333b032
- Reviews: review-1.md PASS
- Cost: worker $0.99, reviews n/a; review rounds 1

## What went in

- `packages/delivery/src/delivery-options.ts`: the always-review list holds `**/roles/**`, `**/criteria/**`, `.agents/**` and `spec/vision.md`, so a branch that changes only the prompt files later jobs read is always reviewed; other Markdown, a README among it, still counts as docs.
- `packages/delivery/docs/commands/review-needed.md`, `README.md`, `arthur.config.example.ts`: say so.
- `packages/delivery/test/review-needed.test.ts`, `packages/orchestration/test/autopilot.test.ts`: docs-only branches of prompt files answer `review`; autopilot refuses a ticket naming one.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1121/1121 passed.

## Left open

- Findings: F1, F2, review notes, dropped (see findings.md).
