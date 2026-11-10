# AR0553 - Review 2

- Job: 2026-11-10-review-b93a9b34
- Branch: arthur/2026-11-10-worker-042e7671
- Commit reviewed: a908396ff4479529c757a5bf06c4b2e05d958680
- Verdict: FAIL

## Final message

## Findings

1. **packages/orchestration/src/voice-reply.ts:13: no test checks that one reply's voice note waits for the previous one.** I changed `last = last.then(() => voice(host, reply)).catch(` to `last = voice(host, reply).catch(`. All 5 tests in `packages/orchestration/test/voice-reply.test.ts` still pass. No other test asks for `speak.say`. `packages/orchestration/docs/commands/coordinator.md:42` promises "one reply's voice note at a time, in the order the replies went", and a test title says "in the order of the replies". But the fake `speak.say` and `channel.send` answer at once, so the order holds even without the queue. Without it, the second reply's send can start while the first reply's upload is still running, so voice notes and `voice note not sent` lines can reach the owner out of order. The review criteria count a key behavior that a mutation removes without any test failing as a FAIL. A test where the first reply's send is slow would catch it.

2. **packages/orchestration/src/voice-reply.ts:25: nothing tests which kinds of part count as a voice note.** I changed `part.kind === "voice"` to `part.kind !== "text"`. All 5 tests still pass. With that change, a reply to a message holding only a photo, a video, a file or an `audio` part would also be spoken and sent as a voice note. The ticket's "Done means" limits voice replies to a message that held a voice note. The tests only compare text parts with voice parts, so this condition is never checked at its edge. A test where the reply answers a message with a photo or audio part and no voice note, and nothing is spoken, would catch it.

## Notes
- (minor) packages/speak/src/say-command.ts:33: a failed `--out` leaves the voice note behind. When `copyFileSync` fails (the test's ENOENT case), the `<uuid>.ogg` stays in `.arthur/speak/` even though the command printed `refused`. This adds a case to F1 that `arthur say` creates itself.

## Checks (all on a908396f)
- `npm run check && npm test`: tsc clean. 1692 tests: 1628 pass, 0 fail, 0 cancelled, 64 skipped.
- `npm run mutate`: 25 mutants, 20 caught, 5 survived, the same five the worker lists. I checked two of them by hand:
  - Deleting `summary` from `speak-options.ts` fails `test/option-tables.test.ts` (4 pass, 1 fail).
  - Deleting the `voices` line from the example config fails `packages/speak/test/speak.test.ts` (9 pass, 1 fail).
- Hand mutations in `voice-reply.ts`:
  - Queue removed: survived (finding 1).
  - `kind !== "text"`: survived (finding 2).
  - The `seqs.includes` filter removed: caught.
  - The `each.plugin === channel` filter removed: caught.
  - `Math.min` changed to `Math.max`: caught.
  - The "answered no send" check removed: caught.
  - The line's `channels` emptied: caught.
- Hand mutations in speak, all caught:
  - In `say.ts`: queue bypassed; queue chained on a rejection; half-OGG removal dropped; WAV removal dropped; `>` changed to `>=` on maxChars; empty-text check dropped.
  - In `speak-tools.ts`: `critical: true`; the X_OK check dropped; the `.json` config check dropped.
  - In `speak-options.ts`: the `.onnx` name check dropped.
- Hand mutations in `media-out.ts`, all caught: voice notes put in one album; the `.ogg` mapping removed; documents put in the photo album.
- Every hand mutation was restored with `git checkout --`. `git status --short` is empty and HEAD is a908396f.
- Package line counts, measured the way `test/structure.ts` counts them: speak 243, orchestration 2884, telegram 682. They match the new budgets exactly, as the ticket asks.
- `npx arthur say --help` prints the doc page. Running `arthur say` itself in a temporary folder is refused inside this job's sandbox ("refused inside a job"), so I exercised the command only through its unit tests.

FAIL