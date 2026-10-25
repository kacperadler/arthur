# AR0426 - Outcome

- Merged: 2026-10-25, `75127d83`
- Branch: arthur/2026-10-25-worker-1b69de5c
- Reviews: review-1.md PASS
- Cost: worker $0.81, reviews n/a; review rounds 1

## What went in

- `packages/telegram/src/media-in.ts`: a forwarded message with no text or caption gets one text part holding the mark alone (`[forwarded from <sender>]`); sender names also lose Unicode line and paragraph separators and format characters (`\p{Zl}`, `\p{Zp}`, `\p{Cf}`).
- `packages/telegram/docs/telegram.md`: "Phone commands" says so.
- `packages/telegram/test/commands.test.ts`: a forwarded photo without caption arrives with the mark; a name with U+2028, U+202E and U+2029 comes out clean.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1119/1119 passed.

## Left open

- Findings: F1-F3, review notes, dropped (see findings.md).
