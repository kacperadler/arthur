# AR0228 - Outcome

- Merged: 2026-10-20, `2e73ad8`
- Branch: h/2026-10-20-ar0228-roadmap-51-freeze-619539f1
- Reviews: review-1.md PASS
- Cost: worker $10.34, reviews $1.60; review rounds 1

## What went in

- `docs/plugin-api.md`: the frozen host API: the plugin shape, every host member, the published types, core events, provided names, the option tables and `./options` contract, and each published module's exports.
- `packages/core`: `host.jobs.unblock` (with `unblockJob`) and `host.board.after` removed, as no plugin used them; `asPlugin`, `pluginStep`, `registry`, `pluginHost` moved to the internal `plugin-host.ts`, `envRefusal` to `env-refusal.ts`; a test fails on a published name or host member the doc does not list.
- `spec/vision.md`, `spec/roadmap.md`: the clause naming `unblock(id)` now points to the doc; README and `arthur.mmd`: entry 51 built; `test/structure.test.ts`: core budget 5684.

## Checks on main

- `npm run check`: passed.
- `npm test`: 778/778 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0229 (F1) dropped; AR0230 (F2, F3).
