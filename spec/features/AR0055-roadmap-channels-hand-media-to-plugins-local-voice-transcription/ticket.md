# AR0055 - Roadmap: channels hand media to plugins; local voice transcription

```json
{
  "id": "AR0055",
  "title": "Roadmap: channels hand media to plugins; local voice transcription",
  "date": "2026-10-16"
}
```

## Description

A channel (Telegram 47-49, Signal 73, WhatsApp 74) only receives: it saves what came (text, photos, an album, a video, a voice note, a file) and emits one `message-received` with its parts typed. Media plugins handle the parts; a new `voice` plugin transcribes voice notes locally with whisper.cpp on the CPU, so the coordinator gets text. Docs only; entries are built later.

## Goal

The owner can talk to Arthur by voice from any channel, nothing leaves the server, and a new channel gets every media feature for free.

- Kind: feat

## Done means

- `spec/roadmap.md` entry 49 (and the contract 73 and 74 reuse): `message-received` carries `parts`, each `{ kind: text | photo | video | voice | audio | file, path?, text?, mime, seconds? }`, an album being several parts of one message; the channel saves files under `.arthur/<channel>/` and transcribes nothing. Before the coordinator gets the turn, the core asks `collect("message.part", part)` of the plugins: each part a plugin claims is replaced by its text (for a voice part, the transcript); an unclaimed media part reaches the coordinator as a saved path, as today; an unclaimed voice part with no voice plugin becomes one line `[voice note not transcribed: the voice plugin is not enabled]` and the channel says the same to the human.
- A new entry, the next free number, Package `voice`: whisper.cpp with a model set in options (`model: "small"` default, `threads`, `language: "pl"` default, `auto` allowed); converts the channel's audio with ffmpeg; one transcription at a time (a queue), each cut after `timeoutSeconds`; the coordinator gets `[voice <seconds> s] <transcript>`; the original file is kept and named. Its `doctor` requirements (80): the whisper.cpp binary, the model file, ffmpeg. Edge cases: an empty or silent note (`[voice: no speech]`), a note longer than `maxSeconds` (refused in one line to the human), a failed transcription (the path, and one line why), two notes at once (queued, in order), the model missing (doctor line, the note passed on as a path).
- The Order paragraph places voice after 49; Later's channels (73, 74) say they use the same `parts`.
- `npm test` and `npm run check` pass. English only.

## Scope

In:
- `spec/roadmap.md`, `arthur.config.example.ts` (the voice plugin's options).

Out:
- Code; transcription in the cloud.

## Decisions

- 2026-10-16: The owner: voice messages transcribed locally (no cloud), as a separate plugin next to the channels, not inside each channel; every incoming message is sorted into its kinds (text, voice, video, images, several at once) and each kind handled by its plugin.
- 2026-10-16: Coordinator: OK on the worker's three calls: first claimer in setup order wins; the voice plugin always claims voice notes (a missing tool hands the note on as a path); the transcript line names the original file.
