# AR0737 - Outcome

- Merged: 2026-11-24, `58fdb06d`
- Branch: arthur/2026-11-24-worker-2fc6a8b5
- Reviews: review-1.md PASS
- Cost: worker $2.01, reviews $0.34; review rounds 1

## What went in

- .agents/arthur/criteria/styleguide.md: states the "One dash" rule under "English only": text Arthur writes uses "-", never "—".
- packages/orchestration/docs/commands/coordinator.md: documents the blocked notice's policy ending as ` - answered by policy (<class id>): <decided>`.
- packages/orchestration/docs/commands/decision.md: names `-` as the sign refused as a fragment, and the notice's policy ending with " - ".
- packages/orchestration/docs/commands/decisions.md: shows the list line as `<question> - open | answered ... | closed ...`.
- packages/orchestration/src/blocked-notice.ts: ends a policy-answered question's notice with ` - answered by policy (...)`, and its comment says so.
- packages/orchestration/src/decision-views.ts: joins a decision's question and its state with " - " in the `arthur decisions` line.
- packages/orchestration/test/decisions.test.ts: expects the " - " texts, and uses "-" in the owner-message fixtures and the refused-sign cases.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1851/1922 passed.

## Left open

- Findings: none; no findings.md on this ticket.
