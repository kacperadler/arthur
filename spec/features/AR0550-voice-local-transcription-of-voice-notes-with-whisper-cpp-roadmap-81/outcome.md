# AR0550 - Outcome

- Merged: 2026-10-28, `6964e6ab`
- Branch: arthur/2026-10-28-worker-1db9989f
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS
- Cost: worker $6.43, reviews $3.42; review rounds 3

## What went in

- A new voice plugin: a voice note or an audio file from any channel reaches the coordinator as its text, transcribed on this server by whisper.cpp (medium model by default), one file at a time, with clear lines for no speech, a file too long, a failed run and a missing tool.
- `arthur transcribe <file> [--times]`, and `voice.transcribe` for other plugins: a file's text, and with `--times` each segment with its start and end in seconds.
- `arthur doctor` names whisper-cli, the model and ffmpeg, each with its fix.
- Its tests catch a moved language limit, a tool on PATH that cannot run, a blank-only file and an empty file name; its line budget is 246 (AR-D264).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1179/1246 passed.

## Left open

- Deferred (client summary): F1. `arthur plugin new` is unknown in Arthur's own checkout
