# AR0364 - Review 1

- Job: 2026-10-25-review-e0737bde
- Branch: arthur/2026-10-25-worker-0239115d
- Commit reviewed: 275c190dd4ac175d8b41be8213002a8701d41ed7
- Verdict: PASS

## Final message

No blocking findings. The branch does everything the AR0364 ticket asks:
- **Chat id check:** `telegram.ts:89` now accepts only `^[1-9]\d*$` and requires a safe integer. Anything else, a group or channel id included, is refused with the exact message the ticket gives, and the value is never printed.
- **Sender check:** `poll.ts:56` now also skips a message whose `from.id !== bot.chat` or that has `sender_chat`.
- **Tests:** test 38 now refuses `-1001234567890`, where the old line 50 accepted it. Test 74 gains a message from another `from.id` and one with `sender_chat`, both dropped with no answer.
- **Docs:** `telegram.md` no longer says "negative for a group", and the `chatIdEnv` `about` text says a positive id, the owner's private chat. Nothing reaches beyond what the ticket allows (no `ownerIdEnv`), as it requires.

## Notes (do not block)
- **Test shape:** `telegram.test.ts:81`: the `sender_chat` test message sits in a private chat and uses the owner's `from.id`. That is not how Telegram shapes it: an anonymous admin's `from` is GroupAnonymousBot, in a group. It is there on purpose, so that only the `sender_chat` check can drop it, and the comment above it says so.
- **Crowded line:** `media-in.ts:14` puts three type fields on one line to keep the line count flat. It reads a little packed, but it is not wrong.
- **`"0"` is not tested:** the regex still refuses it. The worker left it out on purpose, and gives the reason.

## Checks I ran
- `npm ci`: 22 packages added, no errors.
- `npm run check` (`tsc`): no errors.
- `npm test`: 1106 tests, 1048 passed, 0 failed, 58 skipped. The structure tests passed, including the line budget and the import boundaries.
- **Mutations**, each restored with `git checkout --`:
  - Removing `|| message.from?.id !== bot.chat` in `poll.ts` makes test 74 fail.
  - Removing `|| message.sender_chat !== undefined` makes test 74 fail with "the stranger gets nothing back": the `/stopall` ran and was answered.
  - Putting the chat-id pattern back to `^-?[1-9]\d*$` makes test 38 fail on `-42`.
- `git status --short` was empty afterwards. In `packages/telegram/src`, each changed file adds as many lines as it removes, and the files are 89, 69 and 91 lines long.
- **Worker's claims:** the files, the behavior, the commit (`275c190d`, a Conventional Commit with the ticket id as its scope) and the mutation results all match what I saw.

PASS