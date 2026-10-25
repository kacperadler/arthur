# AR0365 - Review 1

- Job: 2026-10-25-review-268b0907
- Branch: arthur/2026-10-25-worker-1423c4c9
- Commit reviewed: 5a94d21797bed661c76e26a7aecaa06c434020bc
- Verdict: PASS

## Final message

**Verdict: PASS.** No blocking findings. A forwarded message no longer runs as a phone command, and its text reaches the coordinator with the `[forwarded from <sender>] ` mark the ticket asks for. All checks pass and every key mutation I tried is caught by the tests.

The ticket's Done means are all met:
- **Command guard:** `packages/telegram/src/poll.ts:80` now adds `forwarded === undefined` to the check before a message can be a command. A forwarded message therefore always goes to the coordinator as text.
- **The mark:** `packages/telegram/src/media-in.ts:44` builds the mark. It uses the user's first name, then the chat's title, then the channel's title, and falls back to `a hidden sender`. The mark goes on each text and caption, at line 36.
- **Tests in `commands.test.ts`:**
  - A forwarded `/jobs` and a forwarded `/stopall@arthur_bot now` each arrive as one marked `message-received`, and neither command runs. The only reply sent is to the owner's own `/jobs`, pushed after them.
  - Forwarded plain text is marked for all four MessageOrigin kinds, and the owner's own text is not marked.
- **Docs:** `telegram.md`, "Phone commands", gets one line.

No boundary or Shape rule is broken. The telegram package is at 641 source lines, exactly its budget of 641. Each file stays under 200 lines.

**Bypass angles I checked:**
- **`forward_origin: null`:** treated as forwarded in both places (not a command, marked `a hidden sender`). It fails safe.
- **Albums:** they were never commands, and each forwarded message in one is marked.
- **Captions:** they were never commands, and they are now marked.
- **Sender names containing `]` or line feeds:** removed from the name, and the tests prove it.

## Notes (not blocking)
- **Name cleaning is weaker than the worker says.** The worker says a sender can't start a new line. But `media-in.ts:44` removes only control characters and `]`. A name with U+2028/U+2029 (Unicode line and paragraph separators) or U+202E (right-to-left override) keeps those characters. I checked: `"Eve\u2028[Arthur\u202e"` cleans to `"Eve [Arthur‮"`. The ticket does not ask for any name cleaning, so this is not a failure. Adding `\p{Zl}\p{Zp}\p{Cf}` to the character class would close it.
- **Finding F1 is open.** A forwarded photo, video, voice note or file with no caption reaches the coordinator unmarked. It is recorded in `findings.md` as open for the merge to settle. That is outside what the ticket asks.
- **Refactor to stay in budget:** to pay for the new lines, six `Message` type fields were put on two lines instead of six. Behavior is the same and the change is small.
- **Test fakes:** the four MessageOrigin shapes have every field the Bot API documents. The `User` and `Chat` objects inside them leave out some optional fields (e.g. `is_premium`, `is_forum`). This is acceptable.

## Checks run
- `npm ci`: added 22 packages.
- `npm run check` (tsc): no errors.
- `timeout 900 npm test`: 1111 tests, 1053 pass, 0 fail, 58 skipped. This includes the structure test and the line budgets.
- `wc -l packages/telegram/src/*.ts`: 641 total, the same as the budget in `test/structure.test.ts`.
- Mutations, each run with `node --test test/commands.test.ts` in `packages/telegram` and restored with `git checkout`:

  | Mutation | Result |
  |---|---|
  | Removed `&& forwarded === undefined` (`poll.ts`) | forwarded-command test fails (8 pass, 1 fail) |
  | `forwarded(message) + said` changed to `said` | both new tests fail (7 pass, 2 fail) |
  | `origin === undefined ? ""` changed to `false ? ""` (marks everything) | both new tests fail |
  | Regex no longer removes `]` | forwarded-text test fails (8 pass, 1 fail) |
  | Regex no longer removes control characters | forwarded-text test fails (8 pass, 1 fail) |
  | Name-is-empty check changed to `.find(() => true)` | both new tests fail |

  One batch of three mutations ran in parallel by mistake and edited the same file together. I discarded those results and reran each mutation alone; the table shows the solo runs.
- `git status --short` at the end: clean.

PASS