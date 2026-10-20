# AR0221 - Outcome

- Merged: 2026-10-20, `718a54a`
- Branch: h/2026-10-20-ar0221-roadmap-49-telegr-5cf10e3c
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $11.77, reviews $1.63; review rounds 2

## What went in

- `packages/core/src/message-parts.ts` (`@arthur/core/parts`): the `parts` contract of `message-received` (text, photo, video, voice, audio, file), its check, `message.part` claims by plugins in setup order, and the coordinator's text for unclaimed parts.
- `packages/core/src/send-command.ts`, `packages/core/docs/commands/send.md`: `arthur send <file>… [--caption] [--place]` asks every enabled channel first and sends only when all took the message; says so when no channel is enabled.
- `packages/telegram/src/media-in.ts`, `media-out.ts`: photos, videos, video notes, voice, audio and documents saved under `.arthur/telegram/` and emitted as parts; files sent out with Telegram's count, size and photo-side limits checked first; `place` (a topic) kept in and out.
- `packages/orchestration/src/inbox.ts`: each owner message waits in `inbox/received/` until its parts are resolved, in order; left-over ones are resolved at the next start; a broken file set aside as `.broken`.
- `test/structure.test.ts`: budgets core 5668, orchestration 1427, telegram 589.

## Checks on main

- `npm run check`: passed.
- `npm test`: 759/759 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: F1 -> AR0223 (planning); F2, F3 dropped.
