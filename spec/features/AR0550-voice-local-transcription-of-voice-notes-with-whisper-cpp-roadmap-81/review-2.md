# AR0550 - Review 2

- Job: 2026-10-28-review-41e8a160
- Branch: arthur/2026-10-28-worker-1db9989f
- Commit reviewed: 10683c47b177482418b1bea48a7626c1e133bf43
- Verdict: FAIL

## Final message

The tests miss two of the branch's key behaviours: changing either one breaks what a user sees, and all 12 voice tests still pass. Both review-1 findings are fixed and the worker's results reproduce. Verdict: FAIL.

## Findings

1. **`packages/voice/src/voice-options.ts:26`: the lower limit of the `language` check has no test.** I changed `/^[a-z]{2,3}$/` to `/^[a-z]{3}$/` and the voice tests stayed at 12 pass, 0 fail. The test at `voice.test.ts:107-116` accepts only `"auto"` and `"yue"`. It never checks that a two-letter code is accepted. With this change, `language: "pl"` (the default, and the value the example in `docs/voice.md` sets) would stop Arthur from starting. The review criteria count an uncaught "limit moved by one" as a FAIL. Fix: add a two-letter code such as `language: "pl"` to the accepted cases.

2. **`packages/voice/src/transcribe.ts:41`: nothing tests a segment that is only `[BLANK_AUDIO]` for `voice.transcribe` or `arthur transcribe`.** I changed `if (h1 === "" || said === "") return [];` to `if (h1 === "") return [];` and all 12 tests still passed. The test at `voice.test.ts:134-137` covers `[BLANK_AUDIO]` only for a message part, where the output does not change. Both docs say a file with only `[BLANK_AUDIO]` is "no speech":
   - `docs/commands/transcribe.md` says the command prints `[no speech in <seconds> s]`.
   - `docs/voice.md` says `segments` is empty.

   I added one throwaway assertion to the command test: `cli(loaded, note({ seconds: 2, segments: [[0, 2, " [BLANK_AUDIO]"]] }))` must give `[0, "[no speech in 2 s]"]`. It passed on the commit. With the change it failed: the command printed an empty line, and `voice.transcribe` returned a segment with empty text. The ticket asks for a test of each edge case for the command and `voice.transcribe`. The assertion and the change are both restored.

3. **`packages/voice/src/transcribe-command.ts:23`: the `file === ""` check is not tested.** I removed it and the tests stayed at 12 pass. Without it, `arthur transcribe ""` exits 1 with a `voice.transcribe` error instead of exit 2 with the usage line, which is what `transcribe.md` says for "no file". This is minor, but it is an empty-input refusal with no test.

## Notes (not blocking)

- Both review-1 findings are fixed, and I confirmed each with its own mutation:
  - `language` `{2,4}`: 11 pass, 1 fail.
  - `X_OK` line deleted: 11 pass, 1 fail.
- **Line budget:** the voice budget in `test/structure.test.ts` is still 300 (246 lines used). AR-D262 says "Not 300", but the owner told me the number is still his open decision, so I did not fail the branch on it.
- **Timeout test:** removing the whisper timeout still makes the suite hang rather than fail, as review-1 found. The worker chose to leave it.
- **Write to `/tmp`:** the worker says it made `/tmp/vo.bak` and deleted it. That was a file outside its worktree, not a test resource, and it left nothing behind.
- **Guard on `voice.transcribe`:** removing the path type check is caught (11 pass, 1 fail).

## Checks run

- **`npm ci`:** exit 0.
- **`npm run check`:** `tsc` printed no errors, exit 0.
- **`npm test`, run twice:**
  - The first run overlapped my mutations, so I don't count it.
  - The second ran on a clean tree, with output to `review-checks.log` in my worktree, which I deleted afterwards: 1245 tests, 1184 pass, 0 fail, 0 cancelled, 61 skipped, exit 0. This matches the worker's numbers.
- **`node --test packages/voice/test/voice.test.ts` on the commit:** 12 pass, 0 fail.
- **Changes the tests caught:** `{2,4}`, `X_OK` removed, and the `voice.transcribe` path check removed.
- **Changes the tests missed:** `{3}` (finding 1), the empty-segment filter (finding 2), and `file === ""` (finding 3).
- Every change was restored with `git checkout --`. `git status` is clean, and none of my commands is still running.

FAIL