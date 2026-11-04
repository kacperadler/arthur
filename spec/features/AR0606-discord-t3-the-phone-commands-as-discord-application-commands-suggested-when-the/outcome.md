# AR0606 - Outcome

- Merged: 2026-11-04, `362c89f8`
- Branch: arthur/2026-11-04-worker-77196c79
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $5.14, reviews $1.59; review rounds 2

## What went in

- packages/discord/src/menu.ts: builds the phone commands for Discord's `/` menu (about cut to 100, one `text` option) and sends them at each READY only when they differ from `commands.json`; a refusal is one stderr line and the record stays.
- packages/discord/src/interaction.ts: handles a picked command: refuses other users, servers, DMs and unknown channels; otherwise sends a deferred answer, routes `/name text` (`/name` when there is no text), sends the reply as follow-ups of at most 2000, and uses the outbox when a follow-up fails.
- packages/discord/src/receive.ts: READY sets the menu and INTERACTION_CREATE runs the handler, both tracked so `idle()` (and a stop) waits for them.
- packages/discord/src/rest.ts: accepts `PUT`; error lines show interaction and webhook tokens as `{token}`.
- packages/discord/src/discord-doctor.ts: adds the `commands` requirement (live guild commands compared with what the plugin would set), with its costs and fix.
- packages/discord/src/discord.ts: gives the doctor the menu list and the `commands.json` path; header comment names menu.ts and interaction.ts.
- packages/discord/test/fake-discord.ts: fake Discord now handles GET/PUT guild commands (PUT checked as Discord checks it), interaction callbacks (late or repeated ones refused), follow-up webhooks, and `api.interaction()`; it refuses message content over 2000 on a channel message and a follow-up.
- packages/discord/test/discord-shapes.json: records application command, application command option, interaction, application command data, interaction data option and guild member from Discord's docs.
- packages/discord/test/fake-shapes.test.ts: checks the new answers and the INTERACTION_CREATE dispatch against the recorded shapes.
- packages/discord/test/menu.test.ts: tests setting the menu, the fake's 100 and 2000 limits, the picked command, replies of 2000 and 2001 and longer ones, refusals, failures, stop, and the doctor's `commands` line.
- packages/discord/test/discord.test.ts: the doctor test expects five lines and three calls.
- packages/discord/docs/discord.md: intro, the new "The `/` menu" section, five doctor lines, invite URL with `applications.commands`, and the step-8 check with `/`.
- spec/roadmap.md: entry 90 describes the guild commands set at each start and the interaction answered by outgoing calls.
- docs/setup.md: Discord phone commands are picked from the `/` menu or typed.
- arthur.config.example.ts: the discord comment says phone commands are picked from the `/` menu or typed.
- test/structure.test.ts: discord line budget raised from 900 to 968.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1447/1518 passed.

## Left open

- Findings: none; no findings.md on this ticket.
