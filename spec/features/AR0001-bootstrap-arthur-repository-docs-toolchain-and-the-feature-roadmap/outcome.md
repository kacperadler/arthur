# AR0001 - Outcome

- Merged: 2026-10-16, `bf0b60a`
- Branch: h/2026-10-16-ar0001-arthur-bootstrap-2d0a16df
- Reviews: review-1.md PASS
- Cost: worker $3.45, reviews $1.08; review rounds 1

## What went in

- `spec/vision.md`: Arthur's own vision, standing alone; `orchestration` is a required plugin (decision 14).
- `docs/architecture/*.mmd`: core and plugins, config flow, versions.
- `arthur.config.example.ts`: example config, `ARTHUR_` env names only, not type-checked yet.
- `LICENSE` (FSL-1.1-ALv2), `README.md` (source-available, in development).
- `.agents/harness/criteria/styleguide.md`, `review.md`: plugins tested apart against the core's fake host, interface only, edge cases.
- `package.json` workspaces, `tsconfig.json`, `packages/core/` with one runner test, `.github/workflows/ci.yml` (ubuntu, Node 24).
- `spec/roadmap.md`: 63 feature tickets in order, covering all 115 inventory rows.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1/1 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
