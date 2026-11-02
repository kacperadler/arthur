# AR0602 - Review 1

- Job: 2026-11-02-review-d929b635
- Branch: arthur/2026-11-02-worker-9c620b28
- Commit reviewed: f8a47c0c5e640ee4318711e35288fbf96923083d
- Verdict: FAIL

## Final message

## Findings

1. **`packages/discord/src/receive.ts:87`: no test catches it when the `await` in the backlog loop is removed.** `npm run mutate` listed `survived: packages/discord/src/receive.ts:87: hunk reverted to the base`. I made the same change by hand (`… ) await hear({ ...message, channel_id: channel }, false);` → `… ) hear(…)`) and ran `node --test packages/discord/test/*.test.ts`: 37 pass, 0 fail. I restored the file with `git checkout`.
   - **Why it matters:** this branch made `hear` async, because it now downloads attachments before it records a message. The `await` is now the only thing that keeps the backlog in order and each message heard once. Without it, the backlog messages are heard all at once:
     - **Order:** a backlog message with a slow download is emitted after the messages that came later, although the code says "oldest first".
     - **`seen.json` can go back:** a slow, older message calls `keep()` after a newer one, so the next session reads the newer messages again. A backlog `/name` command would then run twice, which breaks "a command written while Arthur was away runs once".
     - **Stop:** `idle()` returns before the backlog messages are handled, so a stop no longer waits for them, contradicting the `f8a47c0c` claim that a stop waits for the message in hand.
     - **Crash:** a failed `keep()` in the backlog becomes an unhandled rejection. On Node 24 that ends the process, instead of the stderr line the `try` gives.
   - **Why the tests miss it:** `commands.test.ts:67` and `media.test.ts:71` each put only one message in the backlog, with no attachment.
   - **Fix:** a test with two backlog messages, the older one's CDN download held, that asserts the emit order and that `seen.json` keeps the newer id.
   - This is a mutation of a key behavior that the tests do not catch, which is a FAIL under the review criteria.

## Notes
- (minor) `packages/discord/src/receive.ts:27`: mutate also left the wording of `OTHER` alive. Pinning a message's wording is not required, so this is fine.
- (risk) `packages/discord/src/receive.ts:70`: if `host.commands.route` throws, the message has already been recorded in `seen.json`. The command is dropped with one stderr line and the owner gets no reply in Discord.
- (minor) `packages/discord/src/media-out.ts:28`: the 25 MiB total does not count the `payload_json` part. The caption counts, but the attachment metadata does not; the gap is a few hundred bytes.
- (minor) `CHANGELOG.md` was not edited although the ticket lists it. The worker's reason holds: the file's header says `arthur changelog` generates it at merge and overwrites a hand edit.

## Checks
- `npm ci`, `npm run check`, `npm test` (one call, 1800 s timeout): `tsc` passed with no errors. Tests: 1473 run, 1409 pass, 0 fail, 64 skipped, matching the worker's figures.
- `npm run mutate` (1800 s timeout): the 1800 s timeout cut the run off before it finished, so it gave no complete result. Before that it reported two survivors: `receive.ts:27` and `receive.ts:87`.
- Hand mutation at `receive.ts:87` (`await` removed), then `node --test packages/discord/test/*.test.ts`: 37 pass, 0 fail. File restored; `git status --short` is clean.
- Search for leftover text saying discord's media or commands are planned or partly built, outside `spec/features` and `CHANGELOG.md`: only a quoted question in `spec/decisions.jsonl`, nothing in any doc. `discord.md` has the "Sending files" and "Phone commands" sections.
- Discord line budget 900: `test/structure.test.ts` passed. The 900 is the owner's decision AR-D402.

FAIL