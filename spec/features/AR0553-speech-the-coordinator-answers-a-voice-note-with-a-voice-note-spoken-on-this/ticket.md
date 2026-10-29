# AR0553 - Speech: the coordinator answers a voice note with a voice note, spoken on this server

```json
{
  "id": "AR0553",
  "title": "Speech: the coordinator answers a voice note with a voice note, spoken on this server",
  "date": "2026-10-28"
}
```

## Description

The reverse of the voice plugin: the coordinator's reply to a voice note also goes back as a voice note, spoken on this server by a local text-to-speech engine, never in the cloud. The text reply is still sent, so nothing is lost when the voice is unclear. The owner asked for it on 2026-10-28.

## Goal

Arthur hears the owner (voice, AR0550) but answers only in text. Telegram's channel sends photos, videos and documents (`packages/telegram/src/media-out.ts:13`), not voice notes, and nothing turns text into speech.

- Kind: feat

## Done means

- A `speak` plugin (named by the owner, AR-D277): given a text, it speaks it with Piper (a local neural text-to-speech engine, CPU only) into an OGG/Opus file under `.arthur/speak/` with ffmpeg, with a voice per language (options `voices`, default one Polish and one English voice; `maxChars`, default 1500; `timeoutSeconds`, default 120). `speak.say` is offered through the host, and `arthur say <text> [--out <file>]` writes the file.
- When the owner's message held a voice note, the coordinator's reply to it is also sent as a voice note through the channel it came from; a text message gets a text reply only. The language follows the reply's text.
- The telegram channel sends a voice note (`sendVoice`) for an `.ogg` file.
- `arthur doctor` names `piper`, each voice model and `ffmpeg`, each with its fix, none critical. A reply over `maxChars`, a failed or timed-out run, or a missing tool: the text goes alone, with one line naming why.
- Tests against a fake `piper` and `ffmpeg` and the fake host, for each edge case above; its line budget is its code exactly.
- Its doc page, the example config, the vision's plugin table, the README's plugin list.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/speak/` (new), `packages/telegram/src/media-out.ts` (voice notes), the coordinator's reply path in `packages/orchestration/` where it sends a reply, docs and the structure test.

Out:
- Installing Piper and its voices: asked of the owner at the merge, as for whisper.
- Discord or other channels' voice: when they exist.

## Decisions
- 2026-10-28: AR0553 approved, after the fix queue Q1-Q3; Piper install asked at its merge; the owner: "teraz pytanie z powrotem... jaki plug-in musimy stworzyc, aby dac wam glos. Wiec zrobmy model i zmiencie tekst do glosu (voice note) + AR-D271 go with recommendations" (AR-D273)
- 2026-10-28: Plugins named by verbs: listen (speech to text; the voice plugin renamed) and speak (text to speech, AR0553); video unchanged; the rename is a small ticket before AR0553; the owner: "AR-D277 1" (AR-D277)
