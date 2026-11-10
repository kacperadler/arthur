# AR0678 - Outcome

- Merged: 2026-11-10, `6260e8d7`
- Branch: arthur/2026-11-10-worker-74bbbb32
- Reviews: review-1.md PASS
- Cost: worker $1.76, reviews $0.40; review rounds 1

## What went in

- .agents/arthur/criteria/report.md: the base style's `.nums` gives each tile its own 2 px border and overlaps neighbours by `margin:-2px 0 0 -2px` inside a grid padded `2px 0 0 2px`; the Components line says every line between tiles is drawn once and the last row is not framed past its tiles (AR-D605)
- test/report-check.test.ts: PNG decoding split into `decode`, used by `frame`; new test reading the 420 px screenshot of the base style's tiles: every line 2 px with 6 tiles, and with 5 tiles no line under or right of the last row's empty cell

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1645/1716 passed.

## Left open

- Findings: none; no findings.md on this ticket.
