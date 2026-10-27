# AR0506 - Outcome

- Merged: 2026-10-27, `5b1883ee`
- Branch: arthur/2026-10-27-worker-60aab435
- Reviews: none
- Cost: worker $1.29, reviews $0.00; review rounds 0

## What went in

- `spec/roadmap.md`: entry 89 (the Discord channel) now requires that a forwarded message is never a phone command, and that its text and snapshots reach the coordinator after `[forwarded from <author>]` (the author's name cut of control characters and `]`, `a hidden sender` when Discord names none); an edit (`MESSAGE_UPDATE`) is ignored, both tested against the fake gateway. Entry 90 routes `/name text` to the command registry only from the owner's own message, never a forward or an edit.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1155/1222 passed.

## Left open

- Findings: none; no findings.md on this ticket.
