# AR0553 - Review 3

- Job: 2026-11-10-review-23903a1c
- Branch: arthur/2026-11-10-worker-042e7671
- Commit reviewed: e7048efab2d7cdc2ef9d2ff21cdb7a3be5d28ec5
- Verdict: PASS

## Final message

No finding blocks the merge. Both findings from review b93a9b34 are fixed. The tests now catch the mutation each of them named, and the hand mutations I ran on lines `npm run mutate` did not reach are all caught. Every Done means point of AR0553 is met. F1–F6 already describe the known gaps, and nothing I found is new to them.

- **What was asked:** the `speak` plugin offers `speak.say` and `arthur say`, with Piper making the speech and ffmpeg the OGG/Opus file in `.arthur/speak/`. Its three options and their defaults match the ticket, and texts are spoken one at a time.
- **Reply path:** `packages/orchestration/src/voice-reply.ts` speaks only replies that answer a message holding a `voice` part. It sends the voice note through that channel's own `channel.send`, one reply after another. When the voice note cannot go, one `voice note not sent: <why>` line goes to that channel; with speak not enabled, the text goes alone.
- **Telegram:** an `.ogg` file goes alone as `sendVoice`. The fake's answer and its shape test cover it.
- **`arthur doctor`:** it names piper, each voice and ffmpeg, none critical, each with its fix.
- **Line budget:** speak's budget of 248 equals its five `src` files exactly (50 + 52 + 47 + 71 + 28), counted the way `test/structure.ts` counts. No file is yellow or red.
- **Boundaries:** no plugin imports another, the dependencies stay empty, and there is no class or enum. Docs, the README, the vision table, both diagrams, `plugin-api.md` and the example config all show the change; a search found no stale text.
- **Worker's claims:** the check, test and mutate counts all reproduced. I also checked two of the five claimed survivor catches by hand (`name: "speak"` deleted, `maxChars` deleted from the example config), and both are caught.

## Notes
- (minor) `packages/speak/src/say-command.ts:37`: if the copy to `--out` works but `rmSync` then throws, the command prints `refused:` and exits 1 although `--out` was written.

## Checks (on e7048efa)
- `npm run check`: tsc clean.
- `npm test`: 1693 tests, 1629 pass, 0 fail, 0 cancelled, 64 skipped.
- `npm run mutate`: 25 mutants, 20 caught, 5 survived, the same five the worker lists. By hand:
  - `name: "speak"` deleted: `test/option-tables.test.ts`, 4 pass, 1 fail.
  - the example config's `maxChars` line deleted: speak.test.ts, 9 pass, 1 fail.
- Hand mutations on what mutate did not reach, each run alone and restored with `git checkout`:
  - `voice-reply.ts`, the filter that keeps only messages the reply answers (`seqs.includes(event.seq)`) removed: 5 pass, 1 fail.
  - `voice-reply.ts`, `.filter((each) => each.plugin === channel)` removed: 4 pass, 2 fail.
  - `media-out.ts`, `.ogg` no longer mapped to voice: media.test.ts 7 pass, 1 fail.
  - `media-out.ts`, voice notes grouped into the album: 7 pass, 1 fail.
  - `say.ts`, `>` changed to `>=` on maxChars: speak.test.ts 9 pass, 1 fail.
  - `say.ts`, the removal of a half OGG deleted: 9 pass, 1 fail.
  - `speak-tools.ts`, `critical: false` changed to `true`: 9 pass, 1 fail.
- Running it as a user, in a temporary folder with orchestration and speak configured: `npx arthur say --help` prints the doc page. `arthur say` itself refuses there with "refused inside a job" (the job sandbox), so I could not run it end to end; its behaviour is only covered by speak.test.ts's CLI test.
- The checkout is clean after the mutations (`git status --short` prints nothing).

PASS