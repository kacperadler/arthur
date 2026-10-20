# AR0237 - Outcome

- Merged: 2026-10-20, `534f5c3`
- Branch: h/2026-10-20-ar0237-roadmap-53-review-bbeeea77
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $11.64, reviews $2.40; review rounds 3

## What went in

- Core: `host.jobs.registerExtension(url)` (a `file:` URL of an existing file only); the spawn keeps the extensions in the job record and the wrapper loads them with `-e` after the core's own; recorded in `docs/plugin-api.md`.
- `packages/delivery`: `arthur review-needed <worker job>` decides by the first rule that holds (always-review list with renames, deleted files, secret files or text, docs-only, small branches with passing checks), records it and moves the ticket; delivery's extension writes each `npm run check` / `npm test` run to the job's `checks`, `stale` after a later edit.
- README, `arthur.mmd`, command docs, `test/structure.test.ts` (core 5727, delivery 508).

## Checks on main

- `npm run check`: passed.
- `npm test`: 834/834 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
