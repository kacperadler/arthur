# AR0039 - Outcome

- Merged: 2026-10-16, `82a9965`
- Branch: h/2026-10-16-ar0039-config-check-setu-badcdb9e
- Reviews: review-1.md PASS
- Cost: worker $0.55, reviews $0.59; review rounds 1

## What went in

- `config-check.ts`: `configCheck(path, shell, setupProblem?)` prints the load's setup refusal after the host refusals and exits 1; printed only when the check refused nothing earlier, so no refusal is lost or doubled.
- `cli.ts`: the `config` command passes the load's `problem`; `docs/commands/config.md` says setup runs first.

## Checks on main

- `npm run check`: passed.
- `npm test`: 118/118 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
