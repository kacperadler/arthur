# AR0145 - Outcome

- Merged: 2026-10-19, `b4ab6a6`
- Branch: h/2026-10-19-ar0145-resources-batch-00d689f3
- Reviews: review-1.md PASS, review-2.md PASS, review-3.md PASS, review-4.md PASS
- Cost: worker $11.82, reviews $4.29; review rounds 4

## What went in

- A continued job takes its ticket's CPU and memory caps in force now, not those kept at its spawn (AR0145).
- On a machine without a user slice, a ticket's caps are said to be not held, bare (AR0146).
- A job over its ticket's memory cap ends `limit: memory`, and the ticket's other job is not the kernel's pick (AR0147).
- Free cores come from CPU time over a second, not the load average (AR0150); the scope test expects a CPU quota at most the machine's cores (AR0171).

## Checks on main

- `npm run check`: passed.
- `npm test`: 715/715 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
