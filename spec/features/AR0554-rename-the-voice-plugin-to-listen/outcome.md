# AR0554 - Outcome

- Merged: 2026-10-29, `4fcca560`
- Branch: arthur/2026-10-29-worker-7b9c5d1f
- Reviews: review-1.md PASS
- Cost: worker $3.88, reviews $0.61; review rounds 1

## What went in

- `packages/listen/` (was `packages/voice/`): the plugin `listen` (`@arthur/listen`, export `listen`), its option table, doc page `docs/listen.md`, home folder `.arthur/listen/` and model folder `.arthur/listen/models/`; the host call is `listen.transcribe`; doctor names the move of a model left in `.arthur/voice/models/` as the fix. The part kind `voice`, `arthur transcribe` and the `[voice <s> s]` lines keep their names.
- `packages/video/`: asks `listen.transcribe`; its line reads `not transcribed: the listen plugin is not enabled` (AR-D329).
- `test/structure.test.ts`: budget key `listen`, 246 -> 248 (AR-D329); `test/option-tables.test.ts`: each plugin is named as its package folder.
- Docs: README, `arthur.mmd`, the architecture diagrams, `docs/plugin-api.md`, `spec/vision.md`, `spec/roadmap.md`, the example config and the video doc say `listen`; `package-lock.json` regenerated.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1222/1290 passed.

## Left open

- Deferred (client summary): F1. The core's line for an unclaimed voice note still names the voice plugin
- Deferred (client summary): F2. The model-move fix doctor prints leaves its paths unquoted
- Deferred (client summary): F3. No test covers the fix text for a model given by path
