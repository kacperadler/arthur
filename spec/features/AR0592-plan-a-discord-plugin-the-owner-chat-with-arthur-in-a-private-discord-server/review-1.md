# AR0592 - Review 1

- Job: 2026-10-31-review-416ccec0
- Branch: arthur/2026-10-31-worker-5c004deb
- Commit reviewed: cbf2f0c0ce3959876ff5af88ae04c393ae6c5ba5
- Verdict: FAIL

## Final message

I'm failing this branch: one key behaviour (a rate-limited message is retried, not dropped) can be broken without any test noticing. Everything else I checked holds.

## Findings

1. **`packages/discord/src/outbox.ts:28` and `packages/discord/test/discord.test.ts:199-203`: the 429 retry can be broken and the tests still pass.** I changed `code !== 429` to `true` in `refused`, so a 429 counts as a refusal. `discord.test.ts` still passes. With that change, a rate-limited slice is moved to `outbox/refused/` and never retried, so the owner loses that message. The plan lists this behaviour ("a 429 waits `retry_after`"). The test misses it for two reasons:
   - It waits for `api.took.length === 4` and checks only the time between the last two POSTs. It never checks that the 4th message is `"After the wait."`.
   - Under the change, `setAside` (`outbox.ts:87`) emits its own "set aside" notice. That notice goes out after the `retry_after` hold, so the count and the timing check pass anyway.
   
   The worker's final message says every condition its mutation script slipped past now has an assertion. This one is not covered. The fix is small: assert that `api.took[3]` is `sent(MAIN, "After the wait.")` and that `outbox/refused/` is empty.

## Notes
- (minor) `packages/discord/src/receive.ts:51`: `keep` writes `seen.json` before the text-channel check, so thread and forum message ids are stored per channel. They are never read again, so nothing breaks, but the file grows a little.
- (minor) `packages/discord/src/receive.ts:52`: an owner message that arrives before GUILD_CREATE (`channels` still undefined) gets the "outside the text channels" line instead of being read. This window is tiny in practice.

## Checks run
- `npm ci`, `npm run check`, `npm test` in one bash call, timeout 1800 s: `tsc` clean; 1424 tests, 1362 pass, 0 fail, 62 skipped. This matches the worker's figures.
- I ran ten mutations in `packages/discord/src`, each against its test file, and restored every file with `git checkout`. Nine were caught, one survived:

| Mutation | File | Tests |
|---|---|---|
| Owner (`author.id`) filter removed | `receive.ts` | caught |
| Webhook filter removed | `receive.ts` | caught |
| Server (`guild_id`) filter removed | `receive.ts` | caught |
| Message-type filter removed | `receive.ts` | caught |
| Thread line removed | `receive.ts` | caught |
| 10-minute backlog window made 100 minutes | `receive.ts` | caught |
| Session-start guard `< FLOOR` changed to `<= FLOOR` | `gateway.ts` | caught |
| `ws:` allowed on any host, not only loopback | `gateway.ts` | caught |
| Silent-mode check on notices removed | `discord.ts` | caught |
| 429 counted as a refusal | `outbox.ts:28` | **survived** |

- I compared the diff with plan ticket 1. The worker's final message explains each departure: the backlog (owner's answer to question 2), doctor lines not critical (question 4 B), `CHANGELOG.md` left alone, and `channel.send` left for ticket 2. The line budget of 750 is the owner's option 1 answer.

FAIL