# AR0551 - Review 1

- Job: 2026-10-28-review-bd20481d
- Branch: arthur/2026-10-28-worker-b14d6e94
- Commit reviewed: 03712c831ba21edc0a917174eb3ca0daeafa394c
- Verdict: PASS

## Final message

**Review of AR0551 (`03712c83`): the video plugin can be merged as it is.**

## Findings

None block the merge.

The branch meets every "Done means" point:
- **Claim:** `video.ts` claims every `video` part, from any channel. It reads only `part.path` and writes only under `host.folder`, which is `.arthur/video/`.
- **Frames:** taken at the fixed `everySeconds` step and at scene changes, capped at `maxFrames` with `-frames:v`.
- **Sound:** taken as a 16 kHz mono `pcm_s16le` WAV and sent to `voice.transcribe` through `host.collect`.
- **Line format:** `[video <s> s] <transcript> frames: <path> at <s> s, … (<path>)`.
- **Edge cases:** each named edge case has a test against a fake `ffmpeg`/`ffprobe` and a fake `voice.transcribe` answer. The WAV is removed and the frames are kept.
- **Doctor:** `ffmpeg` is a requirement that is not critical.
- **Docs and budget:** the doc page, the example config, the vision's plugin table and the `video: 186` budget are all there. The budget equals `wc -l` of `packages/video/src/*.ts`.

The four places where the worker went past the ticket each have a reason in the final message and a test. They copy the voice plugin's existing patterns (`timeoutSeconds`, the over-`maxSeconds` reply), so I don't count them as code beyond what the change needs.

There are no boundary breaks. The plugin imports only `@arthur/core` exports and calls the voice plugin through the host. It has no runtime dependencies, no classes or enums, and no file over 200 lines (the largest has 55).

## Notes

- **`packages/video/src/ffmpeg.ts:14`:** the tests don't catch changing `SCENE` from 0.4 to 0.9, because the fake ignores the threshold. It is a tuning constant the ticket doesn't fix, and the doc states 0.4.
- **`packages/video/src/ffmpeg.ts:23`:** the tests don't catch `codec_type === "audio"` → `!== "video"`. Under the fake the two behave the same, because the fake only reports video and audio streams. A real file with a subtitle or data stream and no audio would then be treated as having sound.
- **`packages/video/src/video.ts:35,38`:** when the channel gives `part.seconds`, it is trusted over ffprobe's length for the `maxSeconds` check. This is the same as the voice plugin and is documented; `timeoutSeconds` caps each ffmpeg or ffprobe step either way.
- If ffmpeg succeeds but writes no frames, the line ends in `frames:  (<path>)`, with an empty list.
- The README diagram adds video to the "channels" node, next to voice. It is a media plugin, not a channel.
- The worker's findings F1 (frames are never removed) and F2 (`maxFrames` keeps only the first minute at the defaults) are correctly recorded as `Status: open`.

## Checks run

- **`npm ci`, `npm run check`, `npm test`:** one foreground run, which the harness moved to the background (bg_1). `tsc` exited 0. Tests: 1257, pass 1196, fail 0, skipped 61. This matches the worker's numbers.
- **Second run with output to a file:** `CHECK_EXIT=0`, the same 1257 / 1196 / 0 / 61, `TEST_EXIT=0`. I deleted the log file afterwards.
- **Real ffmpeg 6 (`/usr/bin/ffmpeg`), on a 30 s clip with a sine sound track:**
  - The plugin's exact `select…showinfo` command with `-frames:v 3` printed 3 showinfo lines and wrote `frame-1.png` to `frame-3.png`, so the parsed times match the written files.
  - The plugin's `ffprobe` command printed the same JSON shape as the fake (`programs`, `streams[].codec_type`, `format.duration`).
- **Mutations, each run against `packages/video/test/video.test.ts`, then restored with `git checkout`:**
  - **Caught (25):** kind guard removed; `>=` instead of `>` for `maxSeconds`, both the given and the measured length; WAV removal deleted; folder removal on a frames failure deleted; missing-tool guard disabled; "see arthur doctor" dropped; sound guard forced on; given length ignored; `-ac 2`; first stderr line instead of last; `maxFrames + 1`; no-duration guard disabled; no-speech guard inverted; WAV prefix strip removed; voice-missing guard disabled; least option value 0 instead of 1; non-integers accepted; unknown-option refusal disabled; `isFile` check removed; `critical: true`; audio detection forced true; over-`maxSeconds` reply removed.
  - **Survived (2):** the `SCENE` threshold and `!== "video"`, both in the notes above.
- **Worktree after restoring:** `git status --short` is clean. I deleted the throwaway mutation script and the temporary clip folder.

PASS