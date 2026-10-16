# AR0008 - Outcome

- Merged: 2026-10-16, `7c8a5ce`
- Branch: h/2026-10-16-ar0008-event-stream-b32e80cb
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $2.92, reviews $1.32; review rounds 2

## What went in

- `packages/core/src/events.ts`: `host.events.on` / `emit` / `read`, and the append-only `<home>/events.jsonl` (sequence, time, plugin, name, data); nested emits queued, a throwing handler logged and skipped, a torn last line skipped.
- `packages/core/src/lock.ts`: `withLock(path, run, waitMs)`, a pid lock file with takeover from a dead holder.
- `plugin.ts`, `host.ts`, `testing.ts`: one stream per load, next to `host.commands`; the fake host records `emitted`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 94/94 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0035 (F1), AR0036 (F2).
