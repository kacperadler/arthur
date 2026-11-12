# The speak plugin

AR0553, the listen plugin's reverse: the coordinator's reply to the owner's voice note also goes back as a voice note, spoken on this server by Piper (a local neural text-to-speech engine, on the CPU) and made an OGG/Opus file by ffmpeg; nothing leaves the server. The text reply is still sent first, so nothing is lost when the voice is unclear. Any plugin speaks a text the same way through `speak.say`, and a person through `arthur say` (`arthur say --help`).

```ts
plugins: [orchestration({}), telegram({ ... }), listen({ model: "medium" }), speak({ maxChars: 1500 })],
```

## Options

Each is checked at load; a wrong one refuses the start, `speak.<key>: expected <what>, got <value>`, and any other key is refused as unknown.

| Option | Default | Meaning |
| --- | --- | --- |
| `voices` | `{ pl: "pl_PL-gosia-medium", en: "en_US-lessac-medium" }` | The Piper voice of each language, `pl`, `en` or both: a name such as `pl_PL-darkman-medium`, the file `.arthur/speak/voices/<name>.onnx` with its config `<name>.onnx.json` beside it; or the absolute path of a `.onnx` file, its config at `<path>.json`. Given, it replaces the default whole: a language it leaves out has no voice, and a reply in it goes as text alone. |
| `maxChars` | `1500` | The longest text spoken, in characters; a positive whole number. |
| `timeoutSeconds` | `120` | Seconds piper, then ffmpeg, may each run on one text; past it the process is killed. A positive whole number. |

## `speak.say`

`host.call("speak.say", text)` answers a promise of the absolute path of a new voice note in `.arthur/speak/`, `<uuid>.ogg`, for `text`; the plugin writes nothing anywhere else.

1. The language: Polish when the text holds a Polish letter (`ą ć ę ł ń ó ś ź ż`) or one of the words `nie`, `tak`, `jest`, `czy`, `dla`, `oraz`, `przez`, `tylko`, `jeszcze`, `teraz`, in any case; English otherwise. The voice is the one `voices` names for it.
2. piper reads the text on its stdin and speaks it with that voice into `.arthur/speak/<uuid>.wav` (`piper --model <voice> --output_file <wav>`).
3. ffmpeg makes that WAV a mono 48 kHz Opus file at 32 kb/s, `.arthur/speak/<uuid>.ogg`, the shape Telegram plays as a voice note. The WAV is removed, whatever happened, and so is a half-written OGG.

One text at a time: a queue in the order they were asked, so two replies at once are spoken one after the other. A text that fails or is refused never stops the queue. The promise rejects, nothing run, for:

- a text longer than `maxChars`: `the text has <n> characters, over maxChars <maxChars>`; a blank one: `the text is empty`; anything but a text: `speak.say: expected a text, got <value>`;
- a language `voices` gives no voice: `no voice for <pl | en> in voices`;
- `piper`, the voice's model, its config or `ffmpeg` missing: `piper not found on PATH; see arthur doctor`, `no file <path>; see arthur doctor`, or `ffmpeg not found on PATH; see arthur doctor`;

and, once a tool ran, for piper or ffmpeg exiting non-zero or killed after `timeoutSeconds`: `<piper | ffmpeg>: <the last line it printed on stderr>`, or `<piper | ffmpeg>: timed out after <timeoutSeconds> s`.

The voice notes stay in `.arthur/speak/` once made; the plugin removes none.

## A reply to a voice note

The orchestration plugin asks `speak.say` for the text of each reply it sends that answers a message holding a `voice` part, and sends the voice note through the `channel.send` of the channel that voice note came from, where the reply's text goes, with no place (`arthur coordinator --help`, "The coordinator's inbox"). Telegram sends an `.ogg` file as a voice note (`sendVoice`); Discord, whose `channel.send` has no voice message yet, sends it as the file it is. A reply that answers only text messages goes as text alone. When the voice note cannot go (a refusal above, the channel refusing or failing the send), the text has gone already, and one more line goes to that channel: `voice note not sent: <why>`. Without the speak plugin enabled, the text goes alone and nothing is said.

## `arthur doctor`

A requirement for piper, one for each voice `voices` names and one for ffmpeg, none critical, each costing `a reply to a voice note goes as text alone, and arthur say refuses`:

- `piper`: on `PATH`; fix: `pipx install piper-tts (https://github.com/OHF-Voice/piper1-gpl), which puts piper on PATH`.
- `voice pl`, `voice en`: the voice's model and its config (`no file <path>` names the first missing); fix, for a voice named as [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) names them (`<language>_<REGION>-<speaker>-<quality>`): `curl -fL --create-dirs -o <home>/speak/voices/<name>.onnx <url> && curl -fL -o <home>/speak/voices/<name>.onnx.json <url>.json`, `<url>` its file on Hugging Face; for a path or any other name, put the voice and its config there.
- `ffmpeg`: on `PATH`; fix: `sudo apt-get install -y ffmpeg`.

Installing them is the owner's call; the plugin never downloads anything.
