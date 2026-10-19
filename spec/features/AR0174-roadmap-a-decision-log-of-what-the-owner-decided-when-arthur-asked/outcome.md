# AR0174 - Outcome

- Merged: 2026-10-19, `8b7a138`
- Branch: h/2026-10-19-ar0174-decision-log-road-db3b3fa9
- Reviews: review-1.md PASS
- Cost: worker $1.82, reviews $0.78; review rounds 1

## What went in

- Roadmap entry 96, the decision log: each question Arthur asks the owner (a blocked job, a question, a plan, a second FAIL, a budget raise) and his answer in his own words, in one append-only `spec/decisions.jsonl` per project, written only by `arthur decision`; ids such as `AR-D12`; open questions listed every turn and closed with their job or ticket; up to 5 similar answers in the coordinator's context; redacted with the notice rules.
- README and `arthur.mmd` show the entry as planned.

## Checks on main

- `npm run check`: passed.
- `npm test`: 566/566 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0176 (F1).
