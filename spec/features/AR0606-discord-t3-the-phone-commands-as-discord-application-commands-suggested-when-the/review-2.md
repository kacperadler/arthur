# AR0606 - Review 2

- Job: 2026-11-04-review-af08bb4e
- Branch: arthur/2026-11-04-worker-77196c79
- Commit reviewed: 5d5de7651e01cece20a2c8bc80c47ea385149b39
- Verdict: PASS

## Final message

The branch can be merged. The previous FAIL (`LIMIT` 2000 → 2001 not caught) is fixed, and I found no new blocking problem. The worker's claims hold.

The previous finding (`packages/discord/src/interaction.ts:15`) is fixed:
- The new test, "a reply of exactly 2000 is one follow-up; one of 2001 is two, 2000 and 1" (`packages/discord/test/menu.test.ts`), fails when `LIMIT` is set to 2001 and when it is set to 1999. I ran both.
- The fake Discord now refuses message content over 2000 with `400 Invalid Form Body` (code 50035), on a channel message and on a follow-up webhook (`fake-discord.ts`). The test of the fake's limits checks `[200, 400, 200, 400]`.

Against the ticket's Done means and the approved plan (AR-D482):
- **Menu at each READY:** each command has its `about` (cut to 99 plus `…`) and one optional `text` option. The PUT is skipped when `commands.json` already matches. A refused PUT is one stderr line, the record stays, and the next start sets the menu. Each of these is tested.
- **Picked command:** it is answered with a deferred answer first, then routed as `/name text` (or `/name` with no text) with the same `channel`, `place` and `instance`.
  - The reply goes as follow-ups of at most 2000; when a follow-up fails, the rest goes through the outbox.
  - A deferred answer Discord refuses runs nothing, so a command never runs twice.
  - Another user, another server, a DM, a thread, or an interaction before GUILD_CREATE gets the ephemeral refusal and runs nothing.
- **Typed `/name text`:** unchanged; the existing tests pass untouched.
- **Docs:** `applications.commands` is in the invite URL, the doctor's `commands` line is there, roadmap entry 90 is updated, and `docs/setup.md` and `arthur.config.example.ts` are updated.
  - A search for the old wording ("No application commands", "no menu", "typed as text", "four lines") finds nothing in docs that still describes Discord. The only hits are Slack's own wording and one unrelated test label.
- **Shape and boundaries:**
  - No new source file is past 200 lines: `interaction.ts` is 45, `menu.ts` is 43.
  - The discord budget goes from 900 to 968, which matches the plan's "about 970".
  - No plugin imports another plugin, no class or enum, no runtime dependency.
  - Interaction tokens show as `{token}` in stderr lines; removing that replacement fails 2 tests.

## Notes
- (minor) `packages/discord/src/menu.ts:30`: `if (signal.aborted) return;` has no test. Removing it survives; then a PUT aborted by a stop would print a stderr line.
- (minor) `packages/discord/src/interaction.ts:33`: the filter on the option name `text` has no test. Replacing it with `true` survives; there is only one option today.
- (minor) `packages/discord/src/menu.ts:39`: the check that refuses an array in `commands.json` has no test. Removing it survives, so a record hand-edited into an array is not covered.
- (minor) `packages/discord/src/discord-doctor.ts:41`: removing `|| found.code === 404` survives. This line is not changed by the branch, but the new `commands` check now relies on it.

## Checks
- `npm ci`: 26 packages added.
- `npm run check`: `tsc` clean.
- `npm test`: 1518 tests, 1454 pass, 0 fail, 64 skipped, the same numbers as the worker's.
- `npm run mutate`: 25 mutants, 25 caught, 0 survived (332 not run, `--max 25`).
- `node --import @arthur/core/testing --test packages/discord/test/*.test.ts`: 50 of 50 pass.
- Hand mutations, each run against the discord tests and restored with `git checkout --`; `git status --short --untracked-files=all` was empty afterwards. Caught:
  - `LIMIT` 2001 and 1999.
  - `if (!owner) return` removed.
  - Server check removed; user check removed; channel check removed or inverted to `!== false`.
  - `type !== 2` filter removed.
  - Return after a refused deferred answer removed.
  - Blank-reply line disabled.
  - Outbox fallback removed; fallback off by one.
  - `place` forced to undefined; `instance` dropped; `flags: 64` dropped.
  - Skip when the record matches removed.
  - `DESCRIBED` 101 and 99.
  - Record written before the PUT.
  - Wait for pending work in `idle()` removed.
  - READY id check bypassed.
  - Token hiding in `rest.ts` removed.
  - Doctor: extra listed commands not checked; description not compared.
- Hand mutations that survived: the four listed under Notes.

PASS