# The listen plugin

Roadmap entry 81 (AR0550, renamed from voice in AR0554): a voice note or an audio file the owner sends on any channel reaches the coordinator as its text, transcribed on this server by whisper.cpp (`whisper-cli`) on the CPU; nothing leaves the server. The coordinator and other plugins transcribe any file the same way through `listen.transcribe`, and a person through `arthur transcribe` (`arthur transcribe --help`).

```ts
plugins: [orchestration({}), telegram({ ... }), listen({ model: "medium", language: "pl" })],
```

## Options

Each is checked at load; a wrong one refuses the start, `listen.<key>: expected <what>, got <value>`, and any other key is refused as unknown.

| Option | Default | Meaning |
| --- | --- | --- |
| `model` | `"medium"` | The whisper.cpp model: a name such as `medium`, `small` or `large-v3-turbo`, the file `.arthur/listen/models/ggml-<model>.bin`; or the absolute path of a `.bin` file. |
| `threads` | `4` | The CPU threads `whisper-cli` uses; a positive whole number. |
| `language` | `"pl"` | The language spoken: a code of two or three lower-case letters, or `"auto"` for whisper's own detection. |
| `timeoutSeconds` | `300` | Seconds ffmpeg, then whisper-cli, may each run on one file; past it the process is killed. A positive whole number. |
| `maxSeconds` | `600` | The longest file transcribed, in seconds; a positive whole number. |

## A voice or audio part

Through `message.part` (`arthur send --help`, "Message parts") the plugin claims every `voice` and every `audio` part, from any channel. It reads only the file the part names, which stays where the channel saved it, and writes only in `.arthur/listen/`: ffmpeg converts the file to a 16 kHz mono WAV there, whisper-cli transcribes it with `model`, `threads` and `language`, and the WAV is removed, whatever happened.

One file at a time: a queue in the order the parts were asked for, so two notes at once (an album, two messages, two channels) are transcribed one after the other, each message's parts in its order. A file that fails or is refused never stops the queue. `<kind>` below is `voice` or `audio`; `<seconds>` is the part's `seconds`, else the WAV's length, rounded.

- Transcribed: `[<kind> <seconds> s] <transcript> (<path>)`, the transcript being whisper's segments joined by spaces.
- No speech (no segment, or only whisper's `[BLANK_AUDIO]`): `[<kind>: no speech] (<path>)`.
- Longer than `maxSeconds`: not transcribed (whisper never runs, ffmpeg neither when the part gives its seconds); the coordinator gets `[<kind> <seconds> s: not transcribed: over maxSeconds] (<path>)` and the human one line through the channel the message came from, `voice note of <seconds> s is over maxSeconds <maxSeconds>; not transcribed` (`audio of ...` for an audio part).
- ffmpeg or whisper-cli exiting non-zero, or killed after `timeoutSeconds`: `[<kind> <seconds> s: not transcribed: <why>] (<path>)`, `<why>` being the last line the tool printed on stderr, or `timed out after <timeoutSeconds> s`.
- `whisper-cli`, the model file or `ffmpeg` missing: nothing runs, and the coordinator gets `[<kind> <seconds> s: not transcribed: <whisper-cli | model <path> | ffmpeg> missing; see arthur doctor] (<path>)`; without the part's seconds, `[<kind>: not transcribed: ...]`.

Without the plugin enabled, a voice part reaches the coordinator as `[voice note not transcribed: the voice plugin is not enabled]`, and an audio part as its saved path.

## `listen.transcribe`

`host.call("listen.transcribe", path)` answers a promise of `{ seconds, text, segments }` for the file at `path` (relative to the folder Arthur runs in), each segment `{ start, end, text }` with its start and end in seconds from the start of the file; `text` is `""` and `segments` empty when there is no speech. It goes through the same queue, options and checks as a part, and rejects with an error for each refusal above: `<path>: not transcribed: <why>` (a missing file is `no file <path>`), or `<path>: audio of <seconds> s is over maxSeconds <maxSeconds>; not transcribed`. Another plugin (video, AR0551) reaches it only through the host.

## `arthur doctor`

Three requirements, none critical, each costing `voice notes and audio files reach the coordinator as paths, and arthur transcribe refuses`:

- `whisper-cli`: on `PATH`; fix: build whisper.cpp (`git clone https://github.com/ggml-org/whisper.cpp; cmake -B build; cmake --build build -j --config Release`) and put `build/bin/whisper-cli` on `PATH`.
- `whisper model`: the model file; fix: in whisper.cpp, `sh models/download-ggml-model.sh <model>`, then move `models/ggml-<model>.bin` to `.arthur/listen/models/` (for a path, put the model there). A named model still in `.arthur/voice/models/`, where the plugin kept it while it was called voice, is not used there; the fix is its move, `mkdir -p <home>/listen/models && mv <home>/voice/models/ggml-<model>.bin <home>/listen/models/ggml-<model>.bin`.
- `ffmpeg`: on `PATH`; fix: `sudo apt-get install -y ffmpeg`.

Installing them is the owner's call; the plugin never downloads anything.
