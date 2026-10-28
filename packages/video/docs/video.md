# The video plugin

AR0551: a video the owner sends on any channel reaches the coordinator as what it shows and what is said in it: a few frames as PNG images, and the words of its sound track, transcribed by the voice plugin. ffmpeg cuts it on this server; nothing leaves it.

```ts
plugins: [orchestration({}), telegram({ ... }), voice({ model: "medium" }), video({ everySeconds: 5, maxFrames: 12 })],
```

## Options

Each is a positive whole number, checked at load; a wrong one refuses the start, `video.<key>: expected a positive whole number, got <value>`, and any other key is refused as unknown.

| Option | Default | Meaning |
| --- | --- | --- |
| `everySeconds` | `5` | The fixed step: a frame from each step of this many seconds, the first frame included; a scene change adds one between them. |
| `maxFrames` | `12` | The most frames taken from one video, the first ones in time. |
| `maxSeconds` | `600` | The longest video cut, in seconds; a longer one reaches the coordinator as its path. |
| `timeoutSeconds` | `300` | Seconds ffprobe or ffmpeg may run on one step of a video before it is killed. |

## A video part

Through `message.part` (`arthur send --help`, "Message parts") the plugin claims every `video` part, from any channel. It reads only the file the part names, which stays where the channel saved it, and writes only in `.arthur/video/`, in a folder of its own for each video:

1. ffprobe reads the video's length and whether it has a sound track.
2. ffmpeg takes its frames as `frame-<n>.png`: the first frame, the first of each `everySeconds` step after it, and each scene change (a frame that differs by more than 0.4 from the one before), at most `maxFrames`, each with the second it shows.
3. With a sound track, ffmpeg takes it as a 16 kHz mono WAV, and the plugin asks `voice.transcribe` (`packages/voice/docs/voice.md`) through the host for its text and the time of each segment. The WAV is removed once answered, whatever the answer; the frames stay for the coordinator to open.

`<seconds>` below is the part's `seconds`, else ffprobe's length, rounded; times are in seconds to a tenth.

- Transcribed: `[video <seconds> s] (<start>-<end> s) <text> (<start>-<end> s) <text> ... frames: <frame> at <s> s, <frame> at <s> s, ... (<path>)`.
- No sound track: `[video <seconds> s: no sound] frames: ... (<path>)`; ffmpeg takes no WAV.
- No speech (no segment): `[video <seconds> s: no speech] frames: ... (<path>)`.
- The voice plugin not enabled, refusing, or ffmpeg failing on the sound track: `[video <seconds> s: not transcribed: <why>] frames: ... (<path>)`, `<why>` being `the voice plugin is not enabled`, voice's own reason (`whisper-cli missing; see arthur doctor`, `audio of <seconds> s is over maxSeconds <max>; not transcribed`, ...), or ffmpeg's.
- Longer than `maxSeconds`: not cut (nothing runs when the part gives its seconds, ffprobe alone otherwise); the coordinator gets `[video <seconds> s: not cut: over maxSeconds] (<path>)` and the human one line through the channel the message came from, `video of <seconds> s is over maxSeconds <maxSeconds>; not cut`.
- `ffmpeg` or `ffprobe` missing: nothing runs, and the coordinator gets `[video <seconds> s: not cut: <ffmpeg | ffprobe> missing; see arthur doctor] (<path>)`; without the part's seconds, `[video: not cut: ...]`.
- ffprobe or ffmpeg failing on the video or its frames, or killed after `timeoutSeconds`: `[video[ <seconds> s]: not cut: <why>; see arthur doctor] (<path>)`, `<why>` being the last line the tool printed on stderr, `timed out after <timeoutSeconds> s`, or `ffprobe found no duration`; the frames taken are removed.

Without the plugin enabled, a video part reaches the coordinator as its saved path.

## `arthur doctor`

One requirement, `ffmpeg`, not critical: `ffmpeg` and `ffprobe` (both in the ffmpeg package) on `PATH`; it costs `videos reach the coordinator as paths, without their frames or words`; fix: `sudo apt-get install -y ffmpeg`. The words also need the voice plugin and its own requirements.

The frames stay in `.arthur/video/`; the plugin never removes them.
