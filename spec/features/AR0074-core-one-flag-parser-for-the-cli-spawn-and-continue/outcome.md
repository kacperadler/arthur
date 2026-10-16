# AR0074 - Outcome

- Merged: 2026-10-16, `d6b7621`
- Branch: h/2026-10-16-ar0074-ar0074-core-one-f-ea466a36
- Reviews: review-1.md PASS
- Cost: worker $1.59, reviews $0.87; review rounds 1

## What went in

- `flags.ts` (new, 21 lines): one flag parser for `--project`, the spawn flags and `continue --budget`; every refusal text unchanged. Core 4339 -> 4329 lines.

## Checks on main

- `npm run check`: passed.
- `npm test`: 271/271 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
