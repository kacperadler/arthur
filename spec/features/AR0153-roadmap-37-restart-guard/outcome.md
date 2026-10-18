# AR0153 - Outcome

- Merged: 2026-10-19, `2799aaa`
- Branch: h/2026-10-18-ar0153-0044a3b1
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $11.95, reviews $2.06; review rounds 2

## What went in

- `packages/session/src/restart-guard.ts`: at `arthur run` start notes HEAD, start time and the `src/` folders of the core and every enabled plugin in `.arthur/session/loaded.json`; every spawn and `arthur continue` compares HEAD in those folders and is refused with `restart due: <tickets> changed Arthur's code since arthur run started ...` while they differ; docs- or tests-only merges, a disabled plugin's code, a change later undone and other repositories do not count; only a new `arthur run` clears it; the coordinator's context shows `Restart: none due` or `Restart: due, ...` under `## session`.
- Core: `host.code` lists each plugin's package folders; `--ignore-restart` on `arthur spawn` and `arthur continue` lets one job start (budget 4873). Session budget 539.
- Docs, `arthur.config.example.ts` (the comment that `/restart` clears it corrected), README, `arthur.mmd`: entry 37 built.

## Checks on main

- `npm run check`: passed.
- `npm test`: 523/523 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0160 (F1), AR0161 (F2).
