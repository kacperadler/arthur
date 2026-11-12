# arthur say

Usage: `arthur say <text> [--out <file>]`.

A text spoken on this server by Piper into a voice note, an OGG/Opus file, never in the cloud (the speak plugin, AR0553; docs/speak.md). It goes through `speak.say`, so through the same queue, `voices`, `maxChars` and `timeoutSeconds` as the coordinator's reply to a voice note: one text at a time in this process. The words after `say` are one text, joined by spaces; quote it to keep its punctuation from the shell.

```
$ arthur say 'Gotowe, AR0081 już scalone.'
/home/owner/arthur/.arthur/speak/3f1c9a2e-5b7d-4e8a-9c61-0d2b7f4e8a13.ogg
$ arthur say 'Merged AR0081.' --out reply.ogg
/home/owner/arthur/reply.ogg
```

- Without `--out`: the voice note stays in `.arthur/speak/`, and its path is printed.
- With `--out`: the voice note is moved to `<file>` (relative to the folder `arthur` runs in), whose path is printed.
- The voice is the one `voices` names for the text's language: Polish for a text holding a Polish letter (`ą ć ę ł ń ó ś ź ż`) or one of `nie`, `tak`, `jest`, `czy`, `dla`, `oraz`, `przez`, `tylko`, `jeszcze`, `teraz`; English for any other.

Refused, exit code 1, on stderr, `refused: <why>`:

- a text longer than `maxChars` (default 1500): `the text has <n> characters, over maxChars <maxChars>`;
- a text in a language `voices` gives no voice: `no voice for <pl | en> in voices`;
- `piper` or `ffmpeg` not on `PATH`, or the voice's model or its config missing: `<piper | ffmpeg> not found on PATH; see arthur doctor`, or `no file <path>; see arthur doctor`;
- piper or ffmpeg failing: `<piper | ffmpeg>: <the last line it printed on stderr>`, or `<piper | ffmpeg>: timed out after <timeoutSeconds> s`;
- a `--out` file that cannot be written (its folder missing): Node's error, and the voice note is removed, not left in `.arthur/speak/`.

Exit code 2 for no text, an empty `--out`, or an option other than `--out`. Without the speak plugin enabled, `arthur` has no `say` command.
