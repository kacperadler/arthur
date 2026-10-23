# AR0325 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

Every entry comes from `check.md` beside this file, which holds the rows and how each was checked. Each is written as a missing check: the input the check does not cover and the check that would.

## F1. Telegram answers every member of the configured chat, not the owner alone (AR0311 F7, confirmed)

- Kind: risk
- Severity: medium
- Found by: 2026-10-23-ar0325-security-check-6f2cfa6c (worker), 2026-10-23
- Where: `packages/telegram/src/poll.ts:56` (only `message.chat.id` and `date` are compared; `message.from` and `message.sender_chat` are never read), `packages/telegram/src/telegram.ts:89` (a negative chat id is accepted at load, its message calling it "negative for a group"), `packages/telegram/docs/telegram.md:13` (asks for "the owner's private chat with it") against `:16` ("negative for a group"), `packages/telegram/test/telegram.test.ts:50` (asserts that a group id is accepted), `packages/telegram/src/telegram-options.ts:17` (`chatIdEnv`, no owner id)
- Rule: the channel acts only on the owner's own user id, in the configured chat; commands that stop, merge, restart or spend are the owner's alone.
- What the check does not cover: a message in the configured chat whose sender is not the owner, which exists as soon as the configured id is a group's or supergroup's: any member's text goes to the coordinator marked `[via telegram]`, which the coordinator role reads as the owner (`packages/orchestration/roles/coordinator.md:12`), any member runs `/stopall`, `/steer`, `/restart` and `/silent`, and so does an anonymous admin or a channel posting through the group (`sender_chat`); a member's `/stopall@other_bot` runs too while `getMe` has not answered (`poll.ts:68`). In the throwaway test against the package's fake Bot API, with a supergroup id configured, each of these reached the host or ran and was answered. With a positive chat id, Telegram's own shape makes `chat.id` the owner's user id, and the check holds. The Discord and Slack plans name a `userIdEnv` beside the server (`arthur.config.example.ts:446`, `:461`); the Telegram options name none.
- Suggestion: the smallest fix, since the docs already promise a private chat: in `bot()` (`telegram.ts:89`) refuse a chat id that is not a positive whole number, with `… does not hold a chat id: the owner's private chat with the bot, a positive whole number`, and in `poll.ts:56` also skip a message whose `from.id` is not `bot.chat` or that carries `sender_chat` (a second line, for a Telegram shape nobody foresaw). Tests: `telegram.test.ts:38` turns the line-50 assertion into a refusal of `-1001234567890`; `telegram.test.ts:73` gains a message of the right chat with another `from.id`, and one with `sender_chat`, both dropped unanswered. Docs: `telegram.md:16` and the `chatIdEnv` `about` (`telegram-options.ts:17`) say a positive id, the owner's private chat. If a group chat is wanted later (a project's chat with topics), that is its own ticket with an `ownerIdEnv` per bot, required when the chat id is negative, and the same `from.id` check against it; not part of this fix.
- Status: ticket AR0364

## F2. A message the owner forwarded runs as the owner's own words, a phone command included

- Kind: risk
- Severity: low
- Found by: 2026-10-23-ar0325-security-check-6f2cfa6c (worker), 2026-10-23
- Where: `packages/telegram/src/poll.ts:78-84` (reads the message's `text` alone; `forward_origin`, `quote` and `reply_to_message` are not read), `packages/telegram/src/media-in.ts` (the text part carries no mark of a forward)
- Rule: commands that stop, restart or spend are the owner's alone; what reaches the coordinator as `[via telegram]` is the owner writing.
- What the check does not cover: a message the owner forwards from another person or a channel: its text is handled exactly as text the owner typed. A forwarded text starting with `/stopall`, `/restart` or `/steer <id> <text>` runs the command (in the throwaway test, a forwarded `/stopall` ran and was answered), and a forwarded instruction reaches the coordinator with no sign that someone else wrote it. The owner did send it, so this is a weak form of the rule's break: the action is the owner's, the words are not. The steering of the coordinator by such words is AR0322's area; the command is this area's.
- Suggestion: in `receive` (`poll.ts:80`) a message with `forward_origin` is never a command: it goes to the coordinator as text, its text part beginning `[forwarded from <sender's first name, or the chat's title, or "a hidden sender">] `. Tests in `commands.test.ts`: a forwarded `/jobs` is one `message-received` with the mark and no reply; a forwarded plain text carries the mark. `telegram.md`, "Phone commands", gets one line.
- Status: ticket AR0365
