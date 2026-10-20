# AR0224 - Outcome

- Merged: 2026-10-20, `a5028bd`
- Branch: h/2026-10-20-ar0224-roadmap-50-phone-f10cd1df
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $7.46, reviews $1.71; review rounds 3

## What went in

- `packages/core/src/commands.ts`: `route(text, from?)` passes `{ channel?, place? }` (`PhoneFrom`) to a phone command as its second argument.
- `packages/telegram/src/poll.ts`: a `/name` text goes to the command registry with the topic as `place`; the reply goes back by the same bot to the same chat and topic through the outbox; `/name@bot` matched case-insensitively against `getMe`, a command for another bot dropped; an unknown name gets the registry's line.
- `packages/telegram/src/menu.ts`: at each start each bot's menu is set to the registered phone commands, only when they changed since `.arthur/telegram/menu.json` (keyed by bot id, never the token).
- `packages/telegram/test/commands.test.ts`, `fake-bot-api.ts`: the edge cases, waiting for the replies actually sent; a test of the start notice as it arrives.
- README, `arthur.mmd`: entry 50 built; `test/structure.test.ts`: telegram budget 641.

## Checks on main

- `npm run check`: passed.
- `npm test`: 777/777 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0225 (F1), AR0226 (F2); F3 dropped.
