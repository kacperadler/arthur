# AR0212 - Outcome

- Merged: 2026-10-19, `8de5935`
- Branch: h/2026-10-19-ar0212-telegram-outbox-0e508ec2
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $8.57, reviews $1.64; review rounds 2

## What went in

- `packages/telegram/src/outbox.ts`: every slice to the owner is first a file in `.arthur/telegram/outbox/`, sent oldest first by one process at a time under `outbox.lock`; a failed send is retried once after 2 s, a 429 holds every send for its `retry_after`, a slice that still fails waits with those after it for the next send, poll or start.
- A refused (4xx) slice moves to `outbox/refused/`, the next ones still go, and the owner gets one notice, cut with a note pointing at the whole file; a file that is no slice is set aside with a line on stderr; a topic is kept across a restart.
- A message to a named bot is answered by that bot (AR0211).
- README and `arthur.mmd` show roadmap 48 built.

## Checks on main

- `npm run check`: passed.
- `npm test`: 710/710 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
