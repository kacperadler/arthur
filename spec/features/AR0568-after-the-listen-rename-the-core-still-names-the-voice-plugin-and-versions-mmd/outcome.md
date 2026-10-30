# AR0568 - Outcome

- Merged: 2026-10-30, `8faffe55`
- Branch: arthur/2026-10-30-worker-03eda5fc
- Reviews: review-1.md PASS
- Cost: worker $0.44, reviews $0.28; review rounds 1

## What went in

- `packages/core/src/message-parts.ts`: a voice note not transcribed now reads `[voice note not transcribed: the listen plugin is not enabled]`.
- `packages/core/test/parts.test.ts`: asserts the new wording, so the old one fails.
- `packages/listen/docs/listen.md`, `packages/core/docs/commands/send.md`, `spec/roadmap.md` (entry 49): quote the new line.
- `docs/architecture/versions.mmd`: the first version now shows `uptime`, `nvm`, `findings` and `video`.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1254/1322 passed.

## Left open

- Deferred (client summary): F1. No test reads versions.mmd.
- Deferred (client summary): F2. Roadmap entry 49's Done means still says "a voice note with no plugin enabled".
