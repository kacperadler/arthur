# AR0020 - Outcome

- Merged: 2026-10-16, `9819d29`
- Branch: h/2026-10-16-ar0020-ticket-board-ee737520
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $4.50, reviews $1.52; review rounds 2

## What went in

- `packages/core/src/board.ts`: `host.board` (`list`, `get`, `create`, `move`); ids prefix + 4 digits, never reusing a dropped or folder-only number; writes under `spec/build.json.lock`, temp + rename; `ticket-created`, `ticket-moved`; `planned` refused while guidance remains.
- `board-file.ts`: reads, checks, writes `spec/build.json`; a broken file refused and never overwritten; unknown keys kept.
- `ticket-template.ts`, `packages/core/templates/`; `arthur ticket new | status | all`.
- Projects come from the `projects` provider until entry 41.

## Checks on main

- `npm run check`: passed.
- `npm test`: 134/134 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0040 (F2).
