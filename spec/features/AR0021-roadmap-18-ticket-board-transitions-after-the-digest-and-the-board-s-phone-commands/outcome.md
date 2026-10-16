# AR0021 - Outcome

- Merged: 2026-10-16, `e9c57dc`
- Branch: h/2026-10-16-ar0021-board-transitions-76954a78
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $6.46, reviews $1.73; review rounds 2

## What went in

- `board.ts`, `board-file.ts` (`NEXT`): allowed status moves; merged and dropped final; a refused move writes and emits nothing.
- `board-after.ts`: `arthur ticket after`, refusing unknown, dropped, self and other-project ids and cycles; `ticket-after` event.
- `board-text.ts`: the digest; `board-commands.ts`: `/board`, `/task`, `/findings`.
- `host.ts`: a worker's `job-started` moves its tickets to in-progress.

## Checks on main

- `npm run check`: passed.
- `npm test`: 182/182 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0047 (F1), AR0048 (F2), AR0049 (F3).
