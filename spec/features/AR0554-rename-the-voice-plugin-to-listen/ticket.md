# AR0554 - Rename the voice plugin to listen

```json
{
  "id": "AR0554",
  "title": "Rename the voice plugin to listen",
  "date": "2026-10-28"
}
```

## Description

The speech-to-text plugin built as `voice` (AR0550) becomes `listen`, so the plugins are named by what they do: listen hears, speak (AR0553) talks, video watches. The owner chose the names (AR-D277).

## Goal

`voice` is also Telegram's word for a voice note and the name of a message part kind, so a plugin of that name next to a speaking plugin reads as the wrong one. The owner picked `listen` and `speak` (AR-D277).

- Kind: refactor

## Done means

- `packages/voice/` is `packages/listen/` (`@arthur/listen`, export `listen`), its option table, doc page, doctor lines, folder under the home (`.arthur/listen/`, its model folder `.arthur/listen/models/`) and its line budget key renamed; the host call `voice.transcribe` is `listen.transcribe`, and the video plugin asks for that name.
- A home that still has `.arthur/voice/models/` keeps working: the plugin moves that folder to `.arthur/listen/models/` at its first load, or doctor names the move as the fix (the worker picks the smaller, with a test).
- The part kind `voice`, `arthur transcribe` and every line the coordinator gets (`[voice <s> s] ...`) keep their names.
- Every doc that names the plugin says `listen`: README, vision, roadmap entry 81, the example config, the plugin API doc, the diagrams.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/voice/` to `packages/listen/`, `packages/video/` (the call name), `test/structure.test.ts`, `package-lock.json`, the docs above.

Out:
- The text-to-speech plugin: AR0553, built as `speak`.
- The owner's `arthur.config.ts` (git-ignored): the coordinator changes `voice(...)` to `listen(...)` at the merge.

## Decisions
