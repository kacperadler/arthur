# AR0010 - Outcome

- Merged: 2026-10-16, `db203fd`
- Branch: h/2026-10-16-ar0010-clock-and-quiet-h-81773814
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $2.37, reviews $0.71; review rounds 2

## What went in

- `packages/core/src/clock.ts`: `host.clock`: `timeZone`, `now()`, `local(at?)`, `isQuiet(at?)` (across midnight, equal times never quiet), `next("HH:MM", days?)` strictly after now, DST gap and repeat handled, bounded to a week; refusals name the bad value.
- `host.ts`, `plugin.ts`: one clock per load from `core.timeZone` / `core.quietHours`, shared by every plugin next to events and commands.
- `testing.ts`: the fake host's clock stands still until `setNow`; `@arthur/core/clock` exports the types.

## Checks on main

- `npm run check`: passed.
- `npm test`: 105/105 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
