# AR0154 - Outcome

- Merged: 2026-10-19, `3ff3338`
- Branch: h/2026-10-19-ar0154-orchestration-bat-095bb636
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $10.63, reviews $3.88; review rounds 2

## What went in

- `--autopilot` holds a pre-approved ticket's worker to the budget recorded for it, takes a ticket's own budget from its JSON block (AR0156), and records one ticket at a time under `<home>/orchestration/autopilot-<id>.lock` (AR0155).
- Inbox files are named by event number and time, so a message is not dropped after the event log is cut (AR0135); a turn failure is told once per reason, and again when turns work (AR0165).
- A `/restart` that throws in the tick tells the owner (AR0175).
- A plugin can be set up after an optional one with the core field `after`, so orchestration registers the morning report with schedule optional (AR0168).
- The coordinator's role says when to run `arthur init` and start an onboarding (AR0185); the burst test moves the agent's clock instead of sleeping (AR0137).

## Checks on main

- `npm run check`: passed.
- `npm test`: 701/701 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0213 (F1).
