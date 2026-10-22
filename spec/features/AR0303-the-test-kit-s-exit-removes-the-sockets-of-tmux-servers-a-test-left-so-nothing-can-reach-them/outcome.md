# AR0303 - Outcome

- Merged: 2026-10-23, `a8e6fe1`
- Branch: h/2026-10-22-ar0303-ae6aa9c8
- Reviews: review-1.md PASS
- Cost: worker $1.15, reviews $0.82; review rounds 1

## What went in

- `packages/core/src/testing.ts`: at a test process's exit the kit finds every socket under its folder with `find <root> -type s` (no links followed) and runs `tmux -S <socket> kill-server` on each before removing the folder, so no tmux server a test left outlives `npm test`. core/testing stays 349.
- `packages/core/test/testing.test.ts`: three servers on kit sockets end at the child's exit; a server outside reached through a link keeps running.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1040/1040 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
