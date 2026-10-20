# AR0225 - Outcome

- Merged: 2026-10-20, `8b4e8b0`
- Branch: h/2026-10-20-ar0225-phone-command-nam-ca98ac01
- Reviews: none
- Cost: worker $1.22, reviews n/a; review rounds 0

## What went in

- `packages/core/src/commands.ts`: `PhoneFrom` has an optional `instance`, the named bot a phone command came through.
- `packages/telegram/src/poll.ts`: `receive` builds the sender (`channel`, `place?`, `instance?`) once and passes it to both `host.commands.route` and `message-received`; no budget raised.
- `packages/telegram/test/commands.test.ts`: a named bot's command from topic 12 gets `instance: "shop"`.
- `packages/core/docs/commands/help.md`, `packages/telegram/docs/telegram.md`: name `instance`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 777/777 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: F1 -> AR0226 (running).
