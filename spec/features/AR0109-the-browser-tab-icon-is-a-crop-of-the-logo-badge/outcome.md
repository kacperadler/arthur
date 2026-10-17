# AR0109 - Outcome

- Merged: 2026-10-17, `264289c`
- Branch: h/2026-10-17-ar0109-favicon-crop-79f79533
- Reviews: review-1.md PASS
- Cost: worker $0.63, reviews $0.43; review rounds 1

## What went in

- `docs/logo/arthur-favicon.png`: a 128 px round crop of the badge (head, shoulders, gold code symbols, gold ring, transparent corners); the traced SVG favicon is gone.
- `site/scripts/generate.ts` uses that PNG as the favicon, else the logo, ignoring a leftover SVG; `site/test/generate.test.ts` covers it, and `site/README.md` names the PNG.

## Checks on main

- `npm run check`: passed.
- `npm test`: 357/357 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
