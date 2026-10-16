# AR0071 - Outcome

- Merged: 2026-10-16, `81a3c42`
- Branch: h/2026-10-16-ar0071-pruned-worker-los-711e3a0d
- Reviews: none
- Cost: worker $0.89, reviews $0.00; review rounds 0

## What went in

- `arthur continue` refuses a job whose worktree prune removed, before writing anything: `<id>: its worktree was pruned; spawn a new job on its branch <branch>`; `continue.md` says so.

## Checks on main

- `npm run check`: passed.
- `npm test`: 271/271 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
