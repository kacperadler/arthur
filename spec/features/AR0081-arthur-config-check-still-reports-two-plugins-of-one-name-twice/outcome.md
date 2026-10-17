# AR0081 - Outcome

- Merged: 2026-10-17, `dae7ec2`
- Branch: h/2026-10-17-ar0081-config-check-8fb966b8
- Reviews: review-1.md PASS
- Cost: worker $0.42, reviews $0.25; review rounds 1

## What went in

- `packages/core/src/env.ts`: `checkEnv` keeps only the first plugin of a name, so a duplicate gives the host's one line, not a second prefix line.
- `packages/core/test/env.test.ts`, `config-check.test.ts`: pin one line per duplicate; a prefix shared by different plugins or instances stays refused.
- GitHub CI on the branch: ci and site passed (run 39071266351).

## Checks on main

- `npm run check`: passed.
- `npm test`: 358/358 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
