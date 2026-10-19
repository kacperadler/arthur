# AR0203 - Outcome

- Merged: 2026-10-19, `d284b8c`
- Branch: h/2026-10-19-ar0203-apache-2-0-3ca3a81b
- Reviews: review-1.md PASS
- Cost: worker $0.77, reviews $0.38; review rounds 1

## What went in

- Arthur is licensed under Apache-2.0 (the owner, 2026-10-19), replacing FSL-1.1-ALv2: `LICENSE` is the unmodified Apache 2.0 text, every `package.json` says `Apache-2.0`.
- New `NOTICE`: Copyright 2026 Kacper Adler; the name "Arthur" and its logo are his trademarks and are not licensed.
- New `CONTRIBUTING.md`: every commit carries a DCO 1.1 `Signed-off-by`, or it is not merged.
- README and the vision say open source, the name and logo reserved; old tickets keep their FSL wording as records.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 665/665 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
