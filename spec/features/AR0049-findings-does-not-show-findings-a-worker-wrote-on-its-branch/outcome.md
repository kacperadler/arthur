# AR0049 - Outcome

- Merged: 2026-10-16, `cbfd577`
- Branch: h/2026-10-16-ar0049-findings-from-the-981bd630
- Reviews: review-1.md PASS
- Cost: worker $1.80, reviews $0.47; review rounds 1

## What went in

- `packages/core/src/board-commands.ts`: `/findings <id>` shows a job branch's findings, headed `findings from branch <branch> (not merged)`, when the branch still exists, its own commits changed `findings.md` and the text differs from main's; newest commit first; jobs found from the records in `<home>/jobs/`.
- `cli.ts` passes the home folder; `docs/commands/findings.md` updated.

## Checks on main

- `npm run check`: passed.
- `npm test`: 187/187 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
