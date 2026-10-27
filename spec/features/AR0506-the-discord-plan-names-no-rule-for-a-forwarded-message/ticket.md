# AR0506 - The Discord plan names no rule for a forwarded message

```json
{
  "id": "AR0506",
  "title": "The Discord plan names no rule for a forwarded message",
  "date": "2026-10-27"
}
```

## Description

F8 of AR0404 (spec/features/AR0404-security-review-of-our-own-code-part-3-channels-merge-and-delivery/findings.md).

- Kind: security
- Severity: low
- Found by: 2026-10-27-worker-d27fde45 (worker), 2026-10-27
- Where: `spec/roadmap.md:843-845` (entry 89), `:853-855` (entry 90), `arthur.config.example.ts:444-457`
- Input: a message the owner forwards in the server. Discord sends it with the owner as `author` and the original in `message_snapshots` (a `message_reference` of type forward), from its documentation as recalled: [INFERENCE]. Also an edit, `MESSAGE_UPDATE`, which the GUILD_MESSAGES intent delivers.
- Why the check misses it: the plan's user check (`userIdEnv`) passes both, since the author is the owner. Entry 90 routes any `/name text` to the command registry. The Telegram lesson of AR0365 (a forward is never a command, and its text is marked) is not in the plan.
- What: once built as planned, a forwarded `/stopall` or `/steer` runs as the owner's, and forwarded words reach the coordinator unmarked.
- Suggestion: add to entry 89's Done means: a forwarded message is never a phone command, and its text and snapshots reach the coordinator after `[forwarded from <author>]`; an edit is ignored, as Telegram ignores `edited_message`. Add both as edge cases tested against the fake gateway.

## Goal

The Discord plan carries the Telegram lesson of AR0365 before Discord is built: a forwarded message is never a phone command, and its text is marked. Evidence: `spec/roadmap.md` entries 89 and 90 route any `/name text` from the owner's user to the command registry, with no rule for a forward or an edit.

- Kind: security

## Done means

- Entry 89's Done means: a forwarded message is never a phone command; its text and snapshots reach the coordinator after `[forwarded from <author>]`; an edit (`MESSAGE_UPDATE`) is ignored, as Telegram ignores `edited_message`; both are edge cases tested against the fake gateway.
- `npm run check` and `npm test` pass.

## Scope

In:
- `spec/roadmap.md` (entries 89 and 90).

Out:
- Building the Discord plugin: its own roadmap entries.

## Decisions

- 2026-10-27: Source: F8 of AR0404
