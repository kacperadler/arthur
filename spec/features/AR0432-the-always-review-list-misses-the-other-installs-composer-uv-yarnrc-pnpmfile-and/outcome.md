# AR0432 - Outcome

- Merged: 2026-10-26, `eea54efb`
- Branch: arthur/2026-10-26-worker-cf3af0d4
- Reviews: review-1.md PASS
- Cost: worker $0.44, reviews n/a; review rounds 1

## What went in

- `packages/delivery/src/delivery-options.ts`: the always-review list also holds `composer.json`, `composer.lock`, `uv.lock`, `pyproject.toml`, `.yarnrc.yml`, `.pnpmfile.cjs` and `bunfig.toml`, in any folder.
- `arthur.config.example.ts`, `packages/delivery/docs/commands/review-needed.md`: the same patterns, and which install each belongs to.
- `packages/delivery/test/review-needed.test.ts`: a row per file, in the root and a subfolder.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1139/1145 passed.

## Left open

- Findings: none; no findings.md on this ticket.
