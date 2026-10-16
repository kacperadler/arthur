# AR0040 - Outcome

- Merged: 2026-10-16, `1d374f8`
- Branch: h/2026-10-16-ar0040-board-transient-f-e608af74
- Reviews: review-1.md PASS
- Cost: worker $1.18, reviews $0.38; review rounds 1

## What went in

- `packages/core/src/board.ts`: the board's lock and temporary files (`build.json.lock`, `build.json.tmp`, `ticket.md.tmp`) live in `spec/.board/`, whose own `.gitignore` of `*` is repaired when missing or edited; a writer killed mid-write leaves nothing Git shows.
- `board-file.ts`: `writeBoard` takes the temporary path from its caller.

## Checks on main

- `npm run check`: passed.
- `npm test`: 154/154 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
