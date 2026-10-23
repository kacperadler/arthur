# AR0365 - A message the owner forwarded runs as the owner's own words, a phone command included

```json
{
  "id": "AR0365",
  "title": "A message the owner forwarded runs as the owner's own words, a phone command included",
  "date": "2026-10-23"
}
```

## Description

Two or three sentences: what changes, and for whom.

## Goal

A forwarded Telegram message is never run as a command, and its text reaches the coordinator marked as forwarded; tested.

- Kind: risk

Evidence:
- `packages/telegram/src/poll.ts:78-84` (reads the message's `text` alone; `forward_origin`, `quote` and `reply_to_message` are not read), `packages/telegram/src/media-in.ts` (the text part carries no mark of a forward)
- Found by: 2026-10-23-ar0325-security-check-6f2cfa6c (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: in `receive` (`poll.ts:80`) a message with `forward_origin` is never a command: it goes to the coordinator as text, its text part beginning `[forwarded from <sender's first name, or the chat's title, or "a hidden sender">] `. Tests in `commands.test.ts`: a forwarded `/jobs` is one `message-received` with the mark and no reply; a forwarded plain text carries the mark. `telegram.md`, "Phone commands", gets one line.
- `npm test` and `npm run check` pass.

## Scope

In:
- in `receive` (`poll.ts:80`) a message with `forward_origin` is never a command: it goes to the coordinator as text, its text part beginning `[forwarded from <sender's first name, or the chat's title, or "a hidden sender">] `. Tests in `commands.test.ts`: a forwarded `/jobs` is one `message-received` with the mark and no reply; a forwarded plain text carries the mark. `telegram.md`, "Phone commands", gets one line.

## Decisions

- 2026-10-23: Source: F2 of AR0325
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
