# AR0284 - Outcome

- Merged: 2026-10-22, `34bdce0`
- Branch: h/2026-10-22-ar0284-decision-classes-3454afe5
- Reviews: review-1.md PASS
- Cost: worker $7.08, reviews $1.28; review rounds 1

## What went in

- `packages/orchestration/src/decision-log.ts` and the decision commands: `arthur decision class propose|revoke` record a class of kind `class` in `spec/decisions.jsonl` with its backing decisions and agreement rate; an approved class answers a matching `arthur decision ask` by policy under the same lock; two matching classes go to the owner; a revoke stops later policy answers.
- `arthur decisions --classes` and `arthur decisions <id>` list classes and their revokes; the coordinator's wake gives a policy-answered job question's decision to continue with.
- `test/decisions.test.ts`: every refusal and edge case of entry 97, the agreement rate by number and by an option's words.
- Docs, README, `arthur.mmd`: entry 97 built; orchestration budget 2194.

## Checks on main

- `npm run check`: passed.
- `npm test`: 993/993 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0285 (F1).
