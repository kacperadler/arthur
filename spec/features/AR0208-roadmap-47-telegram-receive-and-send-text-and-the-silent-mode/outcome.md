# AR0208 - Outcome

- Merged: 2026-10-19, `16c2dc6`
- Branch: h/2026-10-19-ar0208-telegram-29caf33c
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $12.10, reviews $1.93; review rounds 2

## What went in

- The `telegram` plugin (roadmap 47): named bots, at most one unnamed; long polling of the owner's chat only (other chats ignored, messages older than 600 s dropped); text in as `message-received`, any other kind answered that only text, photos and files reach the coordinator; a 409 gives one notice, a 429 waits its `retry_after`.
- Replies and notices go out from the unnamed bot (else the first), in slices of 4096 at line breaks, without sound in quiet hours.
- The silent mode in orchestration: `arthur silent` and `/silent` hold notices until it ends; `/silent` typed in Telegram routes to the command with entry 50.
- Test tokens are built at run time, so no token-shaped text is in the repository.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 695/695 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0210 (F1), AR0211 (F2).
