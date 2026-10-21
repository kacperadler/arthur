# AR0258 - Outcome

- Merged: 2026-10-21, `d5ba054`
- Branch: h/2026-10-21-ar0258-role-names-merge-bad058b8
- Reviews: review-1.md PASS
- Cost: worker $0.62, reviews $0.87; review rounds 1

## What went in

- The coordinator's role runs a wake's `arthur merge --auto <job>` in a project with `autoMerge` on, without waiting for the owner, and waits on a refusal that says `it waits`; the Never-merge rule and silent mode name the same exception. A test checks the three lines.

## Checks on main

- `npm run check`: passed.
- `npm test`: 940/940 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
