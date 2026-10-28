# AR0550 - Voice: local transcription of voice notes with whisper.cpp (roadmap 81)

```json
{
  "id": "AR0550",
  "title": "Voice: local transcription of voice notes with whisper.cpp (roadmap 81)",
  "date": "2026-10-28"
}
```

## Description

The voice plugin of roadmap entry 81: a voice note or an audio file the owner sends on any channel reaches the coordinator as its text, transcribed on this server by whisper.cpp, never in the cloud. It also gives the coordinator and other plugins one way to transcribe a file with the time of each segment. The owner asked for it again on 2026-10-28; he uses whisper's medium model every day.

## Goal

Today nothing claims a `voice` or `audio` part: the coordinator gets only the saved file's path (`packages/core/src/message-parts.ts`, `NOT_TRANSCRIBED`), and there is no `packages/voice`. Roadmap entry 81 (`spec/roadmap.md`, "81. Voice") specifies the plugin; the vision lists `voice` as a first-version plugin.

- Kind: feat

## Done means

- Everything roadmap entry 81's Delivers and Done means name, with these changes from the owner (2026-10-28):
  - `model` defaults to `"medium"`, not `"small"`.
  - It claims `audio` parts as well as `voice` parts, with the same lines (`[audio <seconds> s] ...`).
  - It provides `voice.transcribe` through the host: given a file path, the transcript and its segments, each with its start and end in seconds, through the same queue, limits and errors as a part. Another plugin (video, AR0551) reaches it only through the host.
  - A command `arthur transcribe <file> [--times]` prints the transcript, and with `--times` one segment per line with its start and end in seconds; refused for a missing file, a file over `maxSeconds`, and a missing `whisper-cli`, model or `ffmpeg` (naming `arthur doctor`).
- Tests against a fake `ffmpeg` and a fake `whisper-cli` on `PATH`, as entry 81 says, for each refusal and edge case it names and for the command and `voice.transcribe`.
- `docs/commands/transcribe.md`, the plugin's doc, the example config, the vision's plugin line, and its line budget in the structure test.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/voice/` (new): its source, tests and docs.
- `packages/core/src/message-parts.ts`: `NOT_TRANSCRIBED` names audio parts too, if the wording needs it.
- `arthur.config.example.ts`, `docs/commands/transcribe.md`, `spec/vision.md` (the voice line), the structure test's budgets.

Out:
- Installing whisper.cpp or a model: `arthur doctor` names the fix; the owner decides an install.
- Video parts: AR0551.

## Decisions
- 2026-10-28: AR0550 (voice) first and done today; AR0548 and the AR0549 plan wait; other tasks may stop; the owner: "and focus on this voice, other tasks you can stop but this must be done today" (AR-D259)
- 2026-10-28: After the voice plugin merges: whisper.cpp built into ~/.local/bin, the medium model into Arthur voice models folder, voice turned on with language auto; the plugin describes its requirements (arthur doctor); the owner: "AR-D263 - the plugin should be able to discribe what have to be installed and this requirements should be installed. AR-D263 - 1" (AR-D263)
- 2026-10-28: Not 300: the owner finds it too many lines; asked to spread the code across files (already 5 files, at most 77 lines each); the number asked again; the owner: "AR-D262 - too much lines, can we spred this to sepparated files" (AR-D262)
