# AR0268 - Outcome

- Merged: 2026-10-21, `2796ca0`
- Branch: h/2026-10-21-ar0268-role-names-findin-669ae81a
- Reviews: none
- Cost: worker $1.02, reviews $0.00; review rounds 0

## What went in

- The coordinator's role no longer names `arthur findings`; the findings plugin adds that line to the coordinator's context, so a config without it never sees the command.

## Checks on main

- `npm run check`: passed.
- `npm test`: 943/943 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
