# AR0261 - Outcome

- Merged: 2026-10-21, `1212afc`
- Branch: h/2026-10-21-ar0261-roadmap-62-audit-7f8971f2
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $11.08, reviews $1.85; review rounds 2

## What went in

- The `audit` kind in manage: a read-only job on the `auditor` role with the `audit` and `styleguide` criteria, on the commits since the last audit (commits touching only `spec/build.json`, `spec/features/**` or `spec/quality/**` left out), the board digest, stats and open findings; up to 5 proposals or `NO PROPOSALS`; `audit.days`, `audit.at`, `audit.budgetUsd`, `audit.model` register the entry; no commit since makes no job; resumed once after its budget runs out.
- Core: `arthur ticket file <job>` files a job of no ticket into `spec/quality/<date>.md`; `Filing.root`. Budgets core 5737, manage 637.

## Checks on main

- `npm run check`: passed.
- `npm test`: 909/909 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0264 (F2), AR0265 (F3).
