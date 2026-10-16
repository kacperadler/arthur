# AR0068 - Outcome

- Merged: 2026-10-16, `06ad940`
- Branch: h/2026-10-16-ar0068-continue-moves-ti-50bbce43
- Reviews: review-1.md PASS
- Cost: worker $2.55, reviews $0.66; review rounds 1

## What went in

- `job-control.ts`: a continue emits `job-started` for the continued run, after the record and log and before the wrapper; the core moves a worker's tickets from review or done back to in-progress; one `job-started` and one `job-ended` per run.

## Checks on main

- `npm run check`: passed.
- `npm test`: 272/272 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
