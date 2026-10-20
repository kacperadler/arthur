# AR0240 - Outcome

- Merged: 2026-10-21, `aaf9d45`
- Branch: h/2026-10-20-roadmap-60-arthur-health-8131ea0a
- Reviews: review-1.md PASS
- Cost: worker $5.18, reviews $1.02; review rounds 1

## What went in

- `packages/manage/` (new plugin): `arthur health` and `/health` print one line per thing that should have happened by now and has not: a stalled ticket (in-progress or review, no running job, over 1 h), an unpushed main, an uncommitted board, under 10% free space or inodes, plus each plugin's `health` lines; a failing check costs only its line. With `health.everyMinutes`, `arthur run` sends each round's new lines as one notice, kept in `.arthur/manage/health.json` so a restart does not resend them.
- Docs, README, `arthur.mmd`, `docs/plugin-api.md` (manage provides `health`), `test/structure.test.ts` (manage 257).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 849/849 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
