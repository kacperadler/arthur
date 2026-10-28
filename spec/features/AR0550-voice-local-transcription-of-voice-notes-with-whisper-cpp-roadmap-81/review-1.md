# AR0550 - Review 1

- Job: 2026-10-28-review-b27c06ad
- Branch: arthur/2026-10-28-worker-1db9989f
- Commit reviewed: 57bb38244a44fe48c25f069f7e0d68cc0b181263
- Verdict: FAIL

## Final message

## Findings

1. **`packages/voice/src/voice-options.ts:26`: the upper limit of the language check has no test.** Roadmap 81 says the `language` option must be refused at load unless it is a code of two or three lower-case letters. I changed `/^[a-z]{2,3}$/` to `/^[a-z]{2,4}$/` and the voice tests still passed (12 pass, 0 fail). `voice.test.ts:112` tries `"p"` (one letter, below the limit) and `"polish"` (six letters), but nothing with exactly four letters. The review criteria count an uncaught "limit moved by one" as a FAIL. Fix: add a four-letter value such as `"pols"` to the refused list.

2. **`packages/voice/src/voice-tools.ts:18`: no test covers the "executable" check.** I removed the `accessSync(…, constants.X_OK)` line and all 12 tests still passed. Without it, a `whisper-cli` or `ffmpeg` file on `PATH` that cannot be run counts as installed. `arthur doctor` then says `ok`, and every note fails with a spawn error instead of the line `<what> missing; see arthur doctor` that roadmap 81 asks for. This is a refusal that can be disabled without any test noticing.

## Notes (do not block)

- Taking out the whisper timeout (`host.jobs.run("local", argv)` with no limit) does not make a test fail. The suite just hangs until I killed it with `timeout 90` (exit 124, 5 of 12 tests finished). The worker reported this himself. `npm test` would hang the same way.
- The time limit applies to each tool separately, so one file can take up to 2 × `timeoutSeconds` (ffmpeg, then whisper-cli). `docs/voice.md` says so, and it fits roadmap 81's "each run".
- The queue belongs to one process: `arthur transcribe` run from a shell does not wait for the queue of the running `arthur run`. `transcribe.md` says "one file at a time in this process".
- When the part gives its `seconds`, the WAV's own length is never checked against `maxSeconds`. That matches roadmap 81; `timeoutSeconds` still caps the run.
- The 300-line budget in `test/structure.test.ts` (246 lines used today) is the worker's choice. The ticket names no number, so it needs the owner's confirmation, as the worker asked.
- The worker wrote that whisper-cli "isn't installed here". It is now: `/home/kacper/.local/bin/whisper-cli`, dated Oct 28 18:14, with the medium model in the main checkout's `.arthur/voice/models/`. My real-binary smoke below checked the `-np` flag and the segment-line format the worker could not.

## Checks run

- `npm ci; npm run check; npm test` in the foreground (the harness moved it to the background as job bg_1, which ran to the end):
  - `npm run check`: `tsc` printed no errors.
  - `npm test`: 1245 tests, 1184 pass, 0 fail, 61 skipped. This matches the worker's numbers.
  - I also started a second copy writing to log files. Its check printed `CHECK_EXIT=0`, then I stopped its test run once bg_1 had finished, and deleted the logs.
- `node --test packages/voice/test/voice.test.ts`: 12 pass.
- Mutations, each restored with `git checkout -- <file>`:
  - **Caught by the tests:**
    - `>=` instead of `>` in both `maxSeconds` checks
    - the queue removed
    - the ffmpeg exit-code check disabled
    - the whisper-cli exit-code check disabled
    - WAV removal disabled
    - the missing-tool check disabled
    - `[BLANK_AUDIO]` stripping removed
    - the no-file check disabled
    - `.bin` names allowed in `model`
    - `threads >= 0` instead of `>= 1`
    - `audio` parts no longer claimed
    - the over-`maxSeconds` reply never sent
    - the check for an extra argument to `transcribe` removed
    - `-np` dropped from whisper-cli's arguments
  - **Not caught:**
    - `language` `{2,4}` (finding 1)
    - `X_OK` removed (finding 2)
    - the `part.path === undefined` guard removed: harmless, because core's `isPart` already rejects a voice part without a path
  - **Timeout removed:** the suite hangs instead of failing (see the notes).
- Smoke test of the real CLI from a throwaway config with `orchestration({})` and `voice({ maxSeconds: 5 })`, real `ffmpeg`, and a fake `whisper-cli` on `PATH`:
  - transcript: exit 0
  - `--times`: segments `0.00 1.20 …`, exit 0
  - a 7 s file: `audio of 7 s is over maxSeconds 5`, exit 1
  - a missing file: `no file <abs path>`, exit 1
  - no argument: usage line, exit 2
  - a file that is not audio: ffmpeg's last error line, exit 1
  - `arthur doctor`: `voice whisper-cli/whisper model/ffmpeg: ok`
  - no `.wav` was left in `.arthur/voice/`
- Real whisper.cpp: `arthur transcribe a.ogg --times` on a 2 s sine tone, with the real `whisper-cli` and the medium model given by absolute path, printed `0.00 2.00 (dźwięk dzwonka)` and exited 0 after 12 s. No WAV was left behind. So the segment parser and the flags work with the real binary.
- Throwaway folders and logs are removed, and `git status` is clean.

FAIL