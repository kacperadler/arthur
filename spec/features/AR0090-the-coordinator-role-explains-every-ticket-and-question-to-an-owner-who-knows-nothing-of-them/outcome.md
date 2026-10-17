# AR0090 - Outcome

- Merged: 2026-10-17, `4aefdb4`
- Branch: h/2026-10-17-ar0090-plain-words-rule-7d89946a
- Reviews: none
- Cost: worker $1.36, reviews $0.00; review rounds 0

## What went in

- `spec/roadmap.md`: entries 23 (the coordinator's role file) and 65 (the morning report) require, in Done means, that every reply explains each ticket, finding, job or project in a plain sentence and asks each question with what is decided, why, the options and a recommendation, answerable from the message alone.
- `findings.md`: F1, an ssh that exits before reading its input shows EPIPE instead of ssh's own refusal line.

## Checks on main

- `npm run check`: passed.
- `npm test`: 304/304 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0091 (F1).
