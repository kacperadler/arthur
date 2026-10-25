# AR0364 - Outcome

- Merged: 2026-10-25, `8a78e74d`
- Branch: arthur/2026-10-25-worker-0239115d
- Reviews: review-1.md PASS
- Cost: worker $1.41, reviews n/a; review rounds 1

## What went in

- `packages/telegram/src/telegram.ts`: a bot's chat id must be a positive whole number (the owner's private chat with the bot); a group or channel id refuses the load, and the value is never printed.
- `packages/telegram/src/poll.ts`: a message is acted on only when its chat is the owner's, its `from.id` is the owner's, and it carries no `sender_chat`.
- `packages/telegram/src/media-in.ts`: the `Message` type holds `from` and `sender_chat`.
- `packages/telegram/src/telegram-options.ts`, `packages/telegram/docs/telegram.md`, `arthur.config.example.ts`: `chatIdEnv` names the owner's private chat, a positive id; nothing says a group id works.
- `packages/telegram/test/telegram.test.ts`: group ids refused at load; a message from another member and one with `sender_chat` dropped unanswered.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1106/1106 passed.

## Left open

- Findings: F1-F3, review notes, dropped (see findings.md).
