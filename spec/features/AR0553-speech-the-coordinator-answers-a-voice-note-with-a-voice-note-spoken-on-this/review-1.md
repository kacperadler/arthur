# AR0553 - Review 1

- Job: 2026-11-10-review-f626dbca
- Branch: arthur/2026-11-10-worker-042e7671
- Commit reviewed: 9c8fa17ed5e3c46b274cfb77c0f094df89101aac
- Verdict: FAIL

## Final message

I'm failing this branch. The code does what the ticket asks and every check passes, but one key condition can be removed without any test failing.

## Findings

1. **`packages/orchestration/src/voice-reply.ts:24`: no test protects the rule that only messages the reply answers count.** I removed `seqs.includes(event.seq) &&` from the line that finds which channels get a voice note. All 5 tests in `packages/orchestration/test/voice-reply.test.ts` still pass.
   - With that condition gone, `voice` reads the whole event log from the oldest seq in `answers`. Any voice note in that stretch then gets the reply spoken and sent to its channel, even if the reply never answered it.
   - Two cases where that happens:
     - A text reply swept within 500 ms after a voice note arrived for the next turn.
     - A reply that answers an old job-ended wake while a voice note sits later in the log.
   - This breaks the ticket's Done means: "a text message gets a text reply only". The review criteria count an uncaught removed condition of a key behavior as a FAIL.
   - Fix: add a test where a voice note after the answered messages, but not among them, is neither spoken nor sent.

2. **`packages/speak/src/say.ts:37`: the cleanup of a half-written OGG has no test.** I removed `rmSync(`${name}.ogg`, { force: true })` from the `catch`, and all 10 tests in `packages/speak/test/speak.test.ts` still pass.
   - The test "piper or ffmpeg failing, or a run past timeoutSeconds, rejects naming the tool and why, leaves no file…" claims to cover it.
   - But the fake `ffmpeg` never writes the output when it fails or hangs, so the case is never reached.
   - `docs/speak.md` also promises it: "and so is a half-written OGG".
   - Fix: make the fake `ffmpeg` write a partial `.ogg` before it fails or hangs.

## Notes
- (risk) packages/orchestration/src/voice-reply.ts:13: the voice note can arrive before its text, or without it. Telegram sends the text through its outbox queue, which holds a failed slice for the next start, but sends the voice note right away through `channel.send`. So when `sendMessage` fails, the voice note goes alone even though the docs say "after the text". The order only holds because speaking takes seconds.
- (minor) packages/orchestration/src/voice-reply.ts:41: removing the `typeof answer.value !== "function"` guard fails no test. Without it, the line would read "answer.value is not a function" instead of "channel.send answered no send".

## Checks (all on 9c8fa17e)
- **Check and test:** `npm run check && npm test` (1800 s timeout): tsc clean; 1692 tests, 1628 pass, 0 fail, 64 skipped. The skipped ones need tmux or a systemd user manager, which this sandbox doesn't have.
- **`npm run mutate`:** 25 mutants, 20 caught, 5 survived. These are the same 5 the worker named: the example config's hunk, its `voices` and `maxChars` lines, `summary`, and `name: "speak"`. I spot-checked two:
  - Deleting `name: "speak",` fails `test/option-tables.test.ts` (4 pass, 1 fail).
  - Deleting the example's `maxChars` line fails `packages/speak/test/speak.test.ts` (9 pass, 1 fail).
- **Hand mutations (each restored with `git checkout -- <file>`; the tree is clean at the end):**

| Mutation | Result |
| --- | --- |
| `voice-reply.ts`: drop `seqs.includes(event.seq) &&` | survived, 5/5 pass (finding 1) |
| `voice-reply.ts`: drop `.filter((each) => each.plugin === channel)` | caught (2 fail) |
| `voice-reply.ts`: `part.kind === "voice"` → `true` | caught (1 fail) |
| `voice-reply.ts`: always ask `speak.say` | caught (1 fail) |
| `voice-reply.ts`: drop the `typeof answer.value` guard | survived (minor note) |
| `media-out.ts`: voice notes in one group | caught (1 fail) |
| `media-out.ts`: drop `".ogg": "voice"` | caught (1 fail) |
| `say.ts`: drop the half-OGG `rmSync` | survived, 10/10 pass (finding 2) |
| `say.ts`: `maxChars` limit moved by one | caught (2 fail) |
| `say.ts`: queue without `.catch` | caught (5 fail) |

- **Line budget:** speak counts 243 lines with the 160-character rule, matching its new budget.
- **Piper's input:** piper1-gpl's `__main__.py` (upstream main) writes every stdin line into the one `--output_file` WAV, so a reply of several lines is spoken whole.

FAIL