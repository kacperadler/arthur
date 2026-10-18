# AR0140 - Outcome

- Merged: 2026-10-18, `905cc9a`
- Branch: h/2026-10-18-ar0140-d850a4c7
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $8.52, reviews $1.61; review rounds 2

## What went in

- `packages/orchestration/src/autopilot.ts`: `arthur ticket status <id> planned --autopilot [--budget <usd>]` pre-approves a ticket only if it comes from a finding or an audit (a `Source:` Decisions line naming a file that exists), is kind bug or cleanup, has at most 3 Scope files and none on delivery's always-review list (`call("delivery.alwaysReview")`, entry 53), and its budget is above 0 and under the cap; each refusal names the rule broken.
- Core: the `--autopilot` flag hands the request to `ticket.autopilot`; wrong usage exits 2 naming the problem (budget 4866).
- `packages/orchestration/criteria/autopilot.md`: the starting policy text; the coordinator reads the project's `autopilot` criteria next to `styleguide` and warns while a project has none. Orchestration budget 1146.
- Coordinator role and docs, README, `arthur.mmd`: entry 29 built.

## Checks on main

- `npm run check`: passed.
- `npm test`: 513/513 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0154 (F1), AR0155 (F2), AR0156 (F3).
