# AR0606 - Review 1

- Job: 2026-11-04-review-cbb95fdd
- Branch: arthur/2026-11-04-worker-77196c79
- Commit reviewed: 06b62f2eb5d7e7b6bbe19cc19f44680246add8dd
- Verdict: FAIL

## Final message

I'm failing this review: one key limit has no boundary test. Everything else matches the ticket, the approved plan and the worker's message.

## Findings

1. **`packages/discord/src/interaction.ts:15` (`const LIMIT = 2000`)**: changing the limit to `2001` survives. All 49 discord tests still pass with it.
   - The only test of long replies, `menu.test.ts:134`, uses 30 lines of 100 characters. Its first slice ends at 1918 characters and the next line break comes at 2019, so any limit from 2001 to 2018 slices the reply the same way.
   - The fake's `POST /webhooks/{BOT}/{token}` (`fake-discord.ts:134-137`) also accepts any `content` length, though Discord refuses one over 2000.
   - So a follow-up Discord would refuse can pass the tests. The ticket's Done means says "a reply longer than 2000 characters is sliced". The review criteria count an uncaught "limit moved by one" on a key behavior as a FAIL.
   - Fix: add a test with a reply at exactly 2000 and at 2001 characters (one follow-up, then two). Or make the fake refuse content over 2000 with Discord's 50035, as its PUT already does for descriptions over 100.

## Notes
- (minor) `packages/discord/src/interaction.ts:42`: the outbox fallback joins the unsent slices with `"\n"`. Where `slices` cut in the middle of a line, this adds a line break the reply did not have.
- (minor) `packages/discord/src/interaction.ts:36`: a picked command with no `text` is routed as `/name ` (trailing space), while the typed one is `/name`. The test confirms the registry still sees the text as `""`.
- (minor) `packages/discord/src/receive.ts:129-132`: `idle()` waits only for the work pending when it is called. An interaction that arrives during a stop's wait is not waited for.
- (minor) The worker says `menu.ts` is 42 lines; it is 43. It is green either way.

## What checks out
- **Done means**:
  - The menu is set at READY only when it differs from `commands.json`; a refusal is one stderr line and the next start sets it.
  - Picked commands are refused from another user, another server, a DM, a thread, or before the server is known.
  - The deferred answer, then follow-ups, with the outbox when a follow-up fails.
  - A refused deferred answer runs nothing.
  - A stop waits for a command in hand.
  - The doctor's `commands` line, the docs, the invite scope and roadmap entry 90.
- **Line budget**: the discord budget goes from 900 to 968, matching the approved plan's "about 970" (AR-D482). No new file is past green.
- **Boundaries**: no import of another plugin or of a core file by path; no `class` or `enum`.

## Checks
- `npm run check`: `tsc` clean.
- `npm test`: 1517 tests, 1453 pass, 0 fail, 64 skipped, matching the worker's numbers.
- Hand mutations, each run against `packages/discord/test/*.test.ts`. Every file was restored with `git checkout --`, and `git status --short` printed nothing afterwards.
  - Server check removed: caught.
  - Channel check removed: caught.
  - Skip-when-unchanged against the record removed: caught.
  - Return after a refused deferred answer removed: caught.
  - Token hiding in `rest.ts` removed: caught.
  - Blank-reply line removed: caught.
  - Filter on interaction type 2 removed: caught.
  - Wait for pending work in `idle()` removed: caught.
  - `LIMIT` 2000 → 2001: **survived**.
- `npm run mutate`: not run. I kept to a small budget as you asked and tested the key behaviors by hand instead.

FAIL