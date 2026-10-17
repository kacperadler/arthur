# AR0080 - Outcome

- Merged: 2026-10-17, `5dc7de2`
- Branch: h/2026-10-17-ar0080-27036b90
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $3.98, reviews $1.16; review rounds 2

## What went in

- `packages/orchestration/src/board-commands.ts` (moved from core): `arthur board`, `arthur task` and `arthur findings`, registered by the orchestration plugin; with a config that does not load they are unknown commands (exit 2, the load error printed).
- `packages/core/src/jobs.ts`, `job-records.ts`, `plugin.ts`: `host.jobs.list()`, every job record newest first; `host.jobs.running()` is a filter of it.
- `packages/core/test/cli.test.ts`: the core command lists drop the three; its board config registers a small `board` command.
- `board.md`, `task.md`, `findings.md` (moved), `jobs.md`: the new home and the two reads.

## Checks on main

- `npm run check`: passed.
- `npm test`: 356/356 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- F1: fixed by AR0099 (f4c9c73); AR0100 dropped.
