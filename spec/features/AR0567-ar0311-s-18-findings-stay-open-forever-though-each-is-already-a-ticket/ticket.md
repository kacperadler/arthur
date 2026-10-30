# AR0567 - AR0311's 18 findings stay open forever though each is already a ticket

```json
{
  "id": "AR0567",
  "title": "AR0311's 18 findings stay open forever though each is already a ticket",
  "date": "2026-10-30"
}
```

## Description

The 18 findings of the dropped security audit AR0311 all still read open, though each became its own ticket. After this, each one names its ticket, so audits and the coordinator stop treating them as open risks.

## Goal

Every audit and the coordinator start from a lead list that is entirely stale, and items like Telegram's "answers every member" (F7) read as open risks, although `packages/telegram/src/poll.ts:57` now checks `message.from?.id`.

Evidence:
- `spec/features/AR0311-security-audit-of-arthur-before-the-switch/findings.md:21-225`: F1 to F18 all read `Status: open`; AR0311 is `dropped`, and it is the only ticket on the board with open findings.
- AR0311's `ticket.md:58`: the findings "are already tickets (AR0329 onwards)".
- `packages/findings/docs/findings.md:23-33`: an open entry is settled only at a merge, so a dropped ticket's entries never are.
- The audit's mapping: F1 AR0329, F2 AR0330, F3 AR0346 and AR0347, F4 AR0349, F5 AR0353, F6 AR0357, F7 AR0364, F8/F9/F10/F17 AR0319's findings F1 to F4 (each its ticket), F11 AR0358, F12 AR0350, F13 AR0359, F14 AR0373, F15 AR0370, F16 AR0375, F18 AR0366.

- Kind: chore

## Done means

- Every entry F1 to F18 in AR0311's `findings.md` reads `Status: ticket <id>` (several ids where it took more than one), each checked against the named ticket's own title or findings; an entry that matches no ticket keeps `open` and is named in the final message.
- `arthur findings AR0311` shows no open entry that has a ticket.

## Scope

In:
- `spec/features/AR0311-security-audit-of-arthur-before-the-switch/findings.md`: the 18 Status lines.

Out:
- Changing the findings plugin so it settles a dropped ticket's findings.

## Decisions

- 2026-10-30: Source: audit spec/quality/2026-10-30.md
