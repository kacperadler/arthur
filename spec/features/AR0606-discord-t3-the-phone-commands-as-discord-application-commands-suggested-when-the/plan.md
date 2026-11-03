# AR0606 - Plan

- Job: 2026-11-03-plan-df02debb
- Planned at: 20da9810f06aa21e355539befd5340f262cc30f9

## Approach
Each bot puts the phone commands in Discord's `/` menu by itself. A command picked from the menu goes through the same command registry as a typed `/name text`. Nothing new listens on the network: commands arrive over the gateway connection the bot already has, and every answer is an outgoing REST call. Discord sends `INTERACTION_CREATE` whatever intents a bot asks for, since that event belongs to none of the intents in Discord's gateway docs, so the intents (33281) and `gateway.ts` stay as they are.

1. **Setting the menu.** On each `READY`, the bot reads `application.id` from that event, so the plugin needs no extra REST call; the fake Discord already sends this field. It builds the command list from `host.commands.phone()`:
   - each command is `{ type: 1, name, description, options: [{ type: 3, name: "text", description: "the text after the command", required: false }] }`;
   - a description longer than Discord's limit of 100 characters is cut to 99 with `…` added, using `cut()` from `slices.ts`. Without the cut, Discord would refuse the whole list, because two current phone commands are longer than 100: `/restart` (152, `packages/session/src/restart.ts:80`) and `/silent` (102, `packages/orchestration/src/silent.ts:147`).

   It sends the list with `PUT /applications/{id}/guilds/{guild}/commands` only when the list differs from what `.arthur/discord/commands.json` records for `<application id>/<guild>`. The record is written to a temporary name and renamed, like telegram's `menu.ts`. A broken record file counts as empty. A refused PUT is one line on stderr, `…; the / commands are set again at the next start`, and the record is not changed. The first `READY` after `arthur run` starts is "the start", so the next start (or a new gateway session) tries again.

2. **Answering a picked command.** In `receive.ts`, `on()` handles `INTERACTION_CREATE`, and only type 2 (APPLICATION_COMMAND); every other type is ignored.
   - **Refused:** an interaction whose `guild_id` is not the bot's server, whose `member.user.id` is not the owner (a DM brings `user` and no `member`), or whose channel is not one of the server's known text channels. It gets an ephemeral refusal (callback type 4, flags 64, `allowed_mentions: { parse: [] }`) and runs nothing.
   - **Accepted:** the bot sends a deferred answer at once (callback type 5). It always defers, because any command may take longer than 3 s, and that avoids a timing race.
   - It then calls `host.commands.route("/name text")` with the same `{ channel: "discord", place?, instance? }` as a typed command.
   - The reply is cut by `slices(text, 2000)`. Each slice goes as `POST /webhooks/{application_id}/{token}`. Discord's docs say the first such follow-up after a deferred answer edits the loading message, so one endpoint covers both cases.
   - A blank reply is sent as `/name gave no reply`.
   - **Failures:**
     - If the deferred answer is refused (it came too late, or it was replayed after a resume), nothing runs. There is one line on stderr, and Discord shows the owner "did not respond", so a command is never run twice.
     - If a follow-up fails (the 15-minute token expired, or Discord is away), what was not sent goes through the existing outbox to that channel, so the reply is not lost.
   - Interactions do not wait behind the message chain, which a download may hold. They are tracked so that `idle()` (and so `stop`) waits for the one in hand.
3. **Typed `/name text`** does not change.
4. **`arthur doctor`** gets a fifth line per bot, `commands`. It takes the id from the `GET /applications/@me` answer the doctor already fetches, then calls `GET /applications/{id}/guilds/{guild}/commands` and compares names and descriptions with the list the plugin would set.
   - The line is `ok`, or `missing: …` on a mismatch or on a 401/403/404, or `ok (Discord not reached: …)`, like the other lines. It is not critical.
   - The fix names the invite link with `applications.commands`, and removing `.arthur/discord/commands.json` before restarting.
5. **Small changes:**
   - `rest()` accepts `PUT`.
   - The call name in error lines replaces the interaction or webhook token with `{token}`, because `failure()` only hides the bot token.
6. **Docs and line budget:**
   - Docs updated: `discord.md`, roadmap entry 90, and one sentence in `docs/setup.md`.
   - The discord line budget in `test/structure.test.ts` goes up, because the src files already count 838 of 900 (measured the way `test/structure.ts` counts).
7. **Left alone:** telegram, the core registry (its 256-character `about` limit stays; the plugin cuts the description), `gateway.ts`, `outbox.ts`, and the old AR0592/AR0098 plans, which are history.

## Not available directly
none

## Files
- `packages/discord/src/menu.ts` (new, about 40 lines):
  - `menuCommands(host)`: the list sent to Discord, shared with the doctor.
  - `setMenu(host, bot, application, signal)`: compare with the record, PUT, write the record, or one stderr line.
  - The record reader, copied from telegram's `recorded()`; plugins may not import each other.
- `packages/discord/src/interaction.ts` (new, about 60 lines): `interaction(host, bot, data, channels, send)`, which does the type filter, the refusals, the deferred callback, `route`, the sliced follow-ups, the blank-reply line, and the outbox fallback through `send`.
- `packages/discord/src/receive.ts`:
  - `on()` gets a `READY` branch (calls `setMenu` with `record(data.application).id`) and an `INTERACTION_CREATE` branch.
  - A set of pending promises; `idle()` waits for the message chain and that set.
  - The header comment describes the menu.
- `packages/discord/src/rest.ts`: `"PUT"` in the method union; the token in `/interactions/{id}/{token}` and `/webhooks/{id}/{token}` is replaced in the `call` name.
- `packages/discord/src/discord-doctor.ts`:
  - `requirements(bot, want, record)` with the `commands` requirement, its costs ("Discord's / menu does not list the phone commands; typed /name text still works") and its fix.
  - The header comment updated.
- `packages/discord/src/discord.ts`:
  - `host.provide("doctor", …)` passes `() => menuCommands(host)` and `join(host.folder, "commands.json")`.
  - The header comment names menu.ts and interaction.ts.
- `packages/discord/test/fake-discord.ts`:
  - `GET` and `PUT /applications/{BOT}/guilds/{GUILD}/commands`. PUT checks the body as Discord does (name rule, description 1 to 100, option shape; otherwise 400 `Invalid Form Body` 50035) and answers full application command objects.
  - `POST /interactions/{id}/{token}/callback` answers 204.
  - `POST /webhooks/{BOT}/{token}` answers a message object.
  - `api.interaction(fields)` dispatches an `INTERACTION_CREATE` in the documented shape (`member` with `user`, `token`, `version: 1`, `app_permissions`, `entitlements`, `authorizing_integration_owners`, `context`, `attachment_size_limit`, `data` with `id`, `name`, `type`, `options`).
  - Lists `commands`, `callbacks` and `followups`; `fail()` scripts each of these calls.
- `packages/discord/test/discord-shapes.json`: from Discord's docs, record "application command", "application command option", "interaction", "application command data", "application command interaction data option" and "guild member".
- `packages/discord/test/fake-shapes.test.ts`: check the GET/PUT commands answers, a follow-up's message, and the `INTERACTION_CREATE` dispatch against those shapes.
- `packages/discord/test/menu.test.ts` (new): the menu and interaction tests listed under How to test.
- `packages/discord/test/discord.test.ts`: the doctor test expects 5 lines and 3 calls, plus the new `commands` cases.
- `packages/discord/docs/discord.md`:
  - The intro.
  - "Phone commands": drop "Discord shows no menu of them: they are typed as text"; add the `/` menu, the record, the 100-character cut, the refusal, the deferred answer, the slices, the outbox fallback, and that a failed deferred answer runs nothing.
  - "Doctor": five lines.
  - Setup step 4: the invite URL becomes `scope=bot+applications.commands&permissions=101376`, noting that Discord already includes `applications.commands` with `bot`, so a bot invited earlier needs nothing new.
  - Step 8 check: typing `/` lists the commands.
- `spec/roadmap.md`, entry 90: replace "No application commands, so there is no interaction to answer." with the guild commands set at each start from the registry, and the interaction answered over the gateway by outgoing calls, so nothing listens.
- `docs/setup.md:291`: "the phone commands, typed as `/name text`" becomes "picked from Discord's `/` menu or typed as `/name text`".
- `test/structure.test.ts`: `BUDGETS.discord` from 900 to the new count, about 970. The merge's outcome.md says so.

## Risks
- **Discord refuses the whole list** if any one command breaks its rules. The 100-character cut covers today's long descriptions; names already fit, since the registry's `PHONE_NAME` (`^[a-z][a-z0-9]{0,31}$`) is a subset of Discord's rule. More than 100 phone commands would be refused: one stderr line and the doctor's `missing`, not a crash. There are about 15 today.
- **Record says set, but Discord lost the commands**, for example when the bot was removed from the server and invited again. The ticket asks for the record-based skip, so the PUT would not be repeated. The doctor's live GET shows `missing`, and its fix says to remove `.arthur/discord/commands.json` and restart.
- **Interaction token in logs.** `failure()` only hides the bot token. The path of the callback and webhook calls is rewritten in `rest.ts`, and a test asserts the token never appears in stderr.
- **A command run twice.** A deferred answer Discord refuses (late, or replayed by a resume) runs nothing.
- **The first follow-up depends on a documented legacy behaviour**: right after a deferred answer, `POST /webhooks/{app}/{token}` edits the loading message. If Discord dropped this, the fallback would be one `PATCH …/messages/@original`. [INFERENCE that it stays; it is documented today.]
- **Existing tests that see the new calls.** Tests that read `errors` after `READY` (`gateway.test.ts:113`) would get a stderr line if the fake did not answer the PUT, so the fake answers it. The doctor test's `api.calls.length === 2` becomes 3. Tests filtered by `POST` are unaffected, because the PUT is a PUT. All 38 discord tests pass on HEAD (run here).
- **Stop.** A stop must wait for an interaction in hand. `idle()` waits for the pending set, and replies are sent with a non-abortable signal, like the outbox's sends.
- **A `/retro` or `/repeats` picked from the menu** still sends its file through `channel.send` with `from.place`, as when typed, because the `from` object is the same.

## How to test
Run `npm run check` and `npm test` (`node --import @arthur/core/testing --test …`), each in one call with a 1800 s timeout.

- **Commands set at start, only when they differ, refusal retried** (`menu.test.ts`):
  - After `READY`, the PUT's body is exactly each phone command with its `about`, the `/restart`-length one cut to 100 ending in `…`, and the `text` option.
  - A second load sharing the folder sends no PUT.
  - A newly registered phone command, or a broken `commands.json`, brings the PUT back.
  - No phone commands sends `PUT []`.
  - `api.fail(PUT …, 403, { message: "Missing Access", code: 50001 })` gives one stderr line, without the token, and the record unchanged; the next load PUTs and succeeds.
  - A description over 100 sent to the fake is refused with 50035, which shows the fake enforces the documented limit.
- **Documented shapes** (`fake-shapes.test.ts`): every new answer and the `INTERACTION_CREATE` dispatch report no drift against the shapes recorded from the docs.
- **A picked command runs like `/name text`** (`menu.test.ts`):
  - From the owner in the main channel: the callback is type 5 first, then a follow-up with the reply; `commanded` gets `["all", { channel: "discord" }]`.
  - In the project channel it gets `place: PROJECT`; for a named bot it gets `instance` and that bot's token.
  - With no option the text is `""`; an unknown name gets the registry's line.
- **Long replies**: a reply of 30 lines × 101 characters goes as two follow-ups, the first at most 2000 and cut at a line break, in order.
- **Refusals**:
  - Another user, another `guild_id`, a thread channel, a DM (`user`, no `member`), and an interaction before `GUILD_CREATE`: each gets callback type 4 with flags 64 and the refusal text, no follow-up, nothing in `commanded`.
  - Types 3 and 4 make no call at all.
- **Failures and stop**:
  - A refused deferred answer (`404 Unknown interaction 10062`) runs nothing and gives one stderr line without the interaction token.
  - A failed follow-up sends the reply through the outbox to the same channel (`api.took`).
  - A blank reply gives `/name gave no reply`.
  - A stop waits for the interaction's command in hand, and its follow-up still goes.
- **Typed `/name text` unchanged**: every test in `commands.test.ts` passes untouched.
- **Docs and doctor**:
  - `discord.test.ts` doctor test: 5 lines. `commands` is `ok` when the fake's guild commands match `menuCommands`; `missing: …` when they differ; `missing: … (… 403: Missing Access)` with the fix naming `applications.commands` and `commands.json`; `ok (Discord not reached: …)` against `127.0.0.1:9`. Each call is made once per doctor run (3 calls).
  - The setup step's scope is read in `discord.md`.
- **Roadmap and docs**: after the edits, a grep over `spec/roadmap.md`, `docs/` and `packages/discord/docs/` finds no "No application commands", "no menu" or "typed as text" (only the historical AR0592/AR0098 plans keep them).
- **Structure**: `test/structure.test.ts` passes with the raised discord budget, and no new src file is past green.
- **By hand** (not possible in a checkout, reported as such): on the owner's server after the merge, type `/` to see the list, pick `/jobs`, and check `arthur doctor` shows `commands: ok`.

## Open questions
- none