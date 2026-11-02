# AR0582 - Outcome

- Merged: 2026-11-01, `61f2a538`
- Branch: arthur/2026-10-31-worker-6cc4fb61
- Reviews: review-1.md PASS
- Cost: worker $2.24, reviews $0.19; review rounds 1

## What went in

- test/structure.ts: counts each source line as `max(1, ceil(length/160))` (`LINE_WIDTH`) toward a file's zone and its package's line budget.
- test/structure.test.ts: `BUDGETS` set to the width count measured on the merged tree, with discord and dokploy kept at 750 and 450. A new test covers lines of 160, 161, 320 and 321 characters, empty lines, an empty file, a missing final newline, and the edge between green and yellow at 200 lines.
- .agents/arthur/criteria/styleguide.md: a Width clause says a line counts once for every 160 characters it starts, toward the zones and the budget.
- spec/features/AR0582-defaults-t14-a-source-line-over-160-characters-counts-as-more-than-one/findings.md: F1 (settled by AR0600), F2 (`plugin new` counts template lines physically, open), F3 (six files go yellow under the width count, open).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1385/1454 passed.

## Left open

- Deferred (client summary): F2. `arthur plugin new` counts the new package's lines physically
- Deferred (client summary): F3. Six source files go yellow under the width count
