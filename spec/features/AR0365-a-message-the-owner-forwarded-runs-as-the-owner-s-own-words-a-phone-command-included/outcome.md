# AR0365 - Outcome

- Merged: 2026-10-25, `fc17e26e`
- Branch: arthur/2026-10-25-worker-1423c4c9
- Reviews: review-1.md PASS
- Cost: worker $1.12, reviews n/a; review rounds 1

## What went in

- `packages/telegram/src/poll.ts`: a message with `forward_origin` is never a phone command; it goes to the coordinator as text.
- `packages/telegram/src/media-in.ts`: a forwarded message's text and captions begin `[forwarded from <first name, chat or channel title, or a hidden sender>] `, the name cleaned of control characters and `]`.
- `packages/telegram/docs/telegram.md`: "Phone commands" says so.
- `packages/telegram/test/commands.test.ts`: a forwarded `/jobs` and `/stopall@…` run nothing and arrive marked; forwarded text is marked for each of the four origin kinds.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1114/1114 passed.

## Left open

- Tickets from findings: AR0426 (F1, F2); F3, F4 dropped.
