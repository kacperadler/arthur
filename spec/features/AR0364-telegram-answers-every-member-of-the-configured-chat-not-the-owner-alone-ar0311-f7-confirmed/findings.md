# AR0364 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The `sender_chat` test message has a shape Telegram does not send

- Kind: test
- Found by: 2026-10-25-review-e0737bde (reviewer, non-blocking note), 2026-10-25
- Where: `packages/telegram/test/telegram.test.ts:81`
- What: the message sits in a private chat with the owner's `from.id`; a real anonymous admin's `from` is GroupAnonymousBot in a group. It is so on purpose, so only the `sender_chat` check drops it, and the comment says so.
- Status: dropped (deliberate, commented; the other checks are tested by their own rows)

## F2. `media-in.ts:14` holds three type fields on one line

- Kind: refactor
- Found by: 2026-10-25-review-e0737bde (reviewer, non-blocking note), 2026-10-25
- Where: `packages/telegram/src/media-in.ts:14`
- What: packed to keep the line count flat; not wrong.
- Status: dropped (style only; the package's line budget is full)

## F3. A chat id of `"0"` has no test

- Kind: test
- Found by: 2026-10-25-review-e0737bde (reviewer, non-blocking note), 2026-10-25
- Where: `packages/telegram/src/telegram.ts:89`
- What: `^[1-9]\d*$` refuses it; no row asserts so.
- Status: dropped (the regex refuses it by its first character; a negative id, the real mistake, is tested)
