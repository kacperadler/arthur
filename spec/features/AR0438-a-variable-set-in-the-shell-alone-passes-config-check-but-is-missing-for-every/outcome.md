# AR0438 - Outcome

- Merged: 2026-10-29, `4d95ef30`
- Branch: arthur/2026-10-29-worker-72685687
- Reviews: review-1.md PASS
- Cost: worker $1.64, reviews $0.38; review rounds 1

## What went in

- `arthur config check` and `arthur setup` warn, without failing, for each enabled plugin's variable that is set in the shell only and not in the env file: `<name> is set in the shell only; the arthur service does not see it, put it in <envFile>` (the wording of AR-D292); the value is never printed. The core line budget went to 6443 (AR-D293).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1206/1274 passed.

## Left open

- Findings: none; no findings.md on this ticket.
