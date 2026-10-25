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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-25: Source: F1 of AR0365
