# AR0026 - Outcome

- Merged: 2026-10-16, `a263149`
- Branch: h/2026-10-16-ar0026-plugin-new-passes-bb7979ce
- Reviews: none
- Cost: worker $0.36, reviews $0.00; review rounds 0

## What went in

- `spec/roadmap.md` entry 66: `arthur plugin new <name> --budget <lines>` writes `<name>: <lines>` into `BUDGETS`; a missing or bad `--budget` is refused and changes no file; the new package passes the structure test with no hand edit.

## Checks on main

- `npm run check`: passed.
- `npm test`: 105/105 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
