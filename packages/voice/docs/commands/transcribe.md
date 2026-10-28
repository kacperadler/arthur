# arthur transcribe

Usage: `arthur transcribe <file> [--times]`.

A voice note, an audio file or any file ffmpeg reads, transcribed on this server by whisper.cpp, never in the cloud (the voice plugin, AR0550; docs/voice.md). It goes through `voice.transcribe`, so through the same queue, `model`, `threads`, `language`, `timeoutSeconds` and `maxSeconds` as a voice note from a channel: one file at a time in this process.

```
$ arthur transcribe .arthur/telegram/media/note.ogg
Start AR0081 and merge AR0080.
$ arthur transcribe .arthur/telegram/media/note.ogg --times
0.00 2.40 Start AR0081
2.40 4.10 and merge AR0080.
```

- Without `--times`: the transcript, whisper's segments joined by spaces, on one line.
- With `--times`: one segment per line, its start and end in seconds from the start of the file, then its text.
- No speech (no segment, or only whisper's `[BLANK_AUDIO]`): `[no speech in <seconds> s]`.

Refused, exit code 1, nothing transcribed, on stderr:

- a missing file: `refused: <file>: not transcribed: no file <file>`;
- a file longer than `maxSeconds` (default 600): `refused: <file>: audio of <seconds> s is over maxSeconds <maxSeconds>; not transcribed`;
- `whisper-cli` or `ffmpeg` not on `PATH`, or the model file missing: `refused: <file>: not transcribed: <whisper-cli | model <path> | ffmpeg> missing; see arthur doctor`;
- ffmpeg or whisper-cli failing: `refused: <file>: not transcribed: <the last line it printed on stderr>`, or `timed out after <timeoutSeconds> s`.

Exit code 2 for no file, two files, or an option other than `--times`. Without the voice plugin enabled, `arthur` has no `transcribe` command.
