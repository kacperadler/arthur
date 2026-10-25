# AR0426 - A forwarded file without a caption reaches the coordinator unmarked

```json
{
  "id": "AR0426",
  "title": "A forwarded file without a caption reaches the coordinator unmarked",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0365 (spec/features/AR0365-a-message-the-owner-forwarded-runs-as-the-owner-s-own-words-a-phone-command-included/findings.md).

- Kind: security
- Found by: 2026-10-25-worker-1423c4c9 (worker), 2026-10-25
- Where: `packages/telegram/src/media-in.ts:36`
- What: the forward mark goes on a forwarded message's text or caption only, as the ticket asks. A forwarded photo, video, voice note or file with no caption becomes its file part alone, with nothing telling the coordinator that someone else made it; a screenshot of instructions or a forwarded voice note reads as the owner's own. Reproduce: push `{ text: undefined, photo: [...], forward_origin: { type: "user", ... } }` to the fake Bot API; `message-received` holds the photo part and no text.
- Suggestion: when a forwarded message has no text or caption, add one text part holding the mark alone (`[forwarded from <sender>]`); costs about 2 source lines in media-in.ts, so it needs a telegram budget raise or a cut. Out: the files themselves stay unread by the channel.

Also from AR0365's review (F2 of AR0365): the sender's name is cleaned of control characters and `]` only (`media-in.ts:44`); a name holding U+2028/U+2029 or U+202E keeps them (`"Eve\u2028[Arthur\u202e"` cleans to `"Eve [Arthur‮"`). Adding `\p{Zl}\p{Zp}\p{Cf}` to the class closes it.

## Goal

Every forwarded Telegram message reaches the coordinator marked as forwarded, a file with no caption included, and the mark's sender name holds no character that breaks or reverses the line; tested.

- Kind: security

## Done means

- A forwarded message with no text or caption gets one text part holding the mark alone (`[forwarded from <sender>]`). Test in `packages/telegram/test/commands.test.ts`: a forwarded photo without caption gives a `message-received` with the photo part and the mark.
- The name cleaning at `media-in.ts:44` also removes `\p{Zl}`, `\p{Zp}` and `\p{Cf}`; a row with `"Eve\u2028[Arthur\u202e"` gives a clean name.
- The telegram line budget (641) holds, or the worker ends `Blocked: user` asking for a raise.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/telegram/src/media-in.ts`, `packages/telegram/test/commands.test.ts`.

Out:
- Reading the files themselves.

## Decisions

- 2026-10-25: Source: F1 of AR0365
- 2026-10-25: AR0426 approved as written; the owner: "AR0421 to AR0426 - all" (AR-D27)
