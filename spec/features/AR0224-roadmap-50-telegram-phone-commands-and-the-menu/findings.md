# AR0224 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A phone command does not learn which named bot it came through

- Kind: risk
- Found by: 2026-10-20-ar0224-roadmap-50-phone-f10cd1df (worker), 2026-10-20
- Where: `packages/core/src/commands.ts:26`, `packages/telegram/src/poll.ts:84`
- What: `route` passes `{ channel, place }` to a phone command, as roadmap entry 50 says, but not the `instance` (the named bot) that `message-received` carries (AR0211). A project's `chat` key (entry 85) is `{ plugin, instance?, place }`, so `/restart` from a topic of a named bot (entries 36, 88) cannot tell that chat from the same topic number of another bot. The reply itself already goes back by the right bot.
- Suggestion: before the host API freezes (entry 51), add an optional `instance` to `PhoneFrom` and pass the bot's name from telegram's `receive`, as `message-received` does; nothing else changes.
- Status: ticket AR0225

## F2. The outbox's retry test failed once in a full test run

- Kind: risk
- Found by: review of 2026-10-20-ar0224-roadmap-50-phone-f10cd1df (review), 2026-10-20
- Where: `packages/telegram/test/telegram.test.ts:262`
- What: "one retry per send, after 2 s; ..." (from AR0212, untouched here) failed once in the reviewer's full `npm test` of this branch and passed 3 of 3 alone; the failure's message was not kept. Six concurrent runs of it alone here passed 6 of 6, so the cause is not known. One candidate [INFERENCE]: its `retried.at - failed.at >= 2000` compares two `Date.now()` stamps around a 2 s `setTimeout`, which Node's monotonic timer can end a millisecond short of on the wall clock.
- Suggestion: rerun the full suite until it fails to keep the message, then fix the wait it shows; for the candidate, assert at least 1990 ms.
- Status: ticket AR0226

## F3. A command to another bot is checked with `>=` on the replies sent

- Kind: risk
- Found by: 2026-10-20-review-ar0224-roadmap-50-956c85dc (review), 2026-10-20
- Where: `packages/telegram/test/commands.test.ts:55`, `:88`
- What: the wait counts `api.took().length >= K`, which in theory leaves room for an extra reply to a command meant for another bot.
- Suggestion: none; the outbox is empty at that point, so an extra reply would show.
- Status: dropped (the reviewer judged the check sound)
