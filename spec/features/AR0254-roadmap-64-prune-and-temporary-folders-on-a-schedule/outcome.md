# AR0254 - Outcome

- Merged: 2026-10-21, `bcce4ca`
- Branch: h/2026-10-21-ar0254-roadmap-64-prune-bd13280b
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS, review-4.md PASS
- Cost: worker $8.21, reviews $2.04; review rounds 4

## What went in

- With `prune.keepJobsDays` set, manage registers a daily `manage.prune` schedule entry (03:00 in `core.timeZone`, once at start after a missed day): old finished jobs pruned as `arthur prune` does, and `arthur-*` folders in `os.tmpdir()` older than a day removed; a running job's folder is never removed, a folder another user owns is kept with a line.
- Tests sweep a test-owned `TMPDIR`. Budgets core 5730, manage 452.

## Checks on main

- `npm run check`: passed.
- `npm test`: 897/897 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
