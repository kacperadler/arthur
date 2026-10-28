# AR0551 - Video: frames and the spoken words of a video part, with ffmpeg and the voice plugin

```json
{
  "id": "AR0551",
  "title": "Video: frames and the spoken words of a video part, with ffmpeg and the voice plugin",
  "date": "2026-10-28"
}
```

## Description

A video the owner sends on any channel reaches the coordinator as what it shows and what is said in it: a few frames as images, and the words of its sound track, transcribed by the voice plugin. ffmpeg does the cutting on this server; nothing leaves it.

## Goal

Today nothing claims a `video` part: the coordinator gets only the saved file's path (`packages/core/src/message-parts.ts`, `claim`). The coordinator reads images but not video or sound, so a screen recording or a spoken video reaches it as a path it cannot use.

- Kind: feat

## Done means

- A `video` plugin claims every `video` part from any channel. It reads only the file the part names and writes only under `.arthur/video/`:
  - ffmpeg takes frames at a fixed step (option `everySeconds`, default 5) and at scene changes, at most `maxFrames` (default 12), as PNG files;
  - ffmpeg takes the sound track as 16 kHz mono WAV, and the plugin asks `voice.transcribe` (AR0550) through the host for its text and segment times;
  - the coordinator gets `[video <seconds> s] <transcript> frames: <path at s>, ... (<path>)`, each frame with the second it was taken at.
- Edge cases, each with a test against a fake `ffmpeg` and a fake host answer for `voice.transcribe`: a video with no sound track (frames only, `no sound`); the voice plugin not enabled or failing (frames, and `not transcribed: <why>`); a video over `maxSeconds`; ffmpeg missing or failing (the part passed on as its path, naming `arthur doctor`); options refused at load when not positive whole numbers; the WAV removed after its transcription, the frames kept for the coordinator to open.
- Its `arthur doctor` requirement: `ffmpeg` on `PATH`, not critical.
- The plugin's doc, the example config, the vision's plugin table, and its line budget in the structure test.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/video/` (new): its source, tests and docs.
- `arthur.config.example.ts`, `spec/vision.md` (a video line in the plugin table), the structure test's budgets.

Out:
- Transcription itself: AR0550's `voice.transcribe`.
- Installing ffmpeg: it is already on this server.

## Decisions
