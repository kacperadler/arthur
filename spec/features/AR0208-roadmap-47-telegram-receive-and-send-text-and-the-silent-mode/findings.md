# AR0208 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. The nvm package still names the old licence

- Kind: cleanup
- Found by: 2026-10-19-ar0208-telegram-29caf33c (worker), 2026-10-19
- Where: `packages/nvm/package.json:5`
- What: every package says `"license": "Apache-2.0"` since AR0203, but nvm, merged just before it, still says `"SEE LICENSE IN ../../LICENSE"` (`grep -rn '"license"' packages/*/package.json`).
- Suggestion: set it to `"Apache-2.0"`, and have `test/structure.ts`'s manifest check refuse any other value, so the next new package cannot drift; nothing else changes.
- Status: open

## F2. A message to a named bot is answered by the unnamed one

- Kind: improvement
- Found by: 2026-10-19-ar0208-telegram-29caf33c (worker), 2026-10-19
- Where: `packages/telegram/src/telegram.ts` (`main`), `packages/orchestration/src/inbox.ts` (`queue`)
- What: with several bots, every bot's messages reach the coordinator as `{ channel: "telegram", text }`, but the replies and notices go only from the unnamed bot (else the first) to its chat, since neither `message-received` nor `coordinator-replied` says which bot a message came through. The owner writing to a second bot gets the answer in the first bot's chat.
- Suggestion: when entries 85 and 86 bind a named bot to a project's chat, carry the bot (an instance) with the message and its reply, as `place` is carried; until then the docs say the unnamed bot sends.
- Status: open
