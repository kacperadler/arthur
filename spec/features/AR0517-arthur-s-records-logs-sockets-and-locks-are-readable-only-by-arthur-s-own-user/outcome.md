# AR0517 - Outcome

- Merged: 2026-10-27, `94f98593`
- Branch: arthur/2026-10-27-worker-28919cbd
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS
- Cost: worker $8.29, reviews $2.54; review rounds 3

## What went in

- `packages/core/src/cli.ts`: every `arthur` command runs under umask 077, so records, logs, locks, the event log, plugin folders and job worktrees are made owner-only (`0600` files, `0700` folders), whatever umask started it.
- `packages/orchestration/src/coordinator.ts`: the coordinator's start is refused when `coordinator.tmux.socket` is a path in a folder the group or others may enter, naming the folder and its mode; a plain socket name needs no check.
- `packages/core/test/umask.test.ts`, `packages/orchestration/test/coordinator.test.ts`: a job's files are owner-only; open folders (`0o750`, `0o711`, `0o705`, `0o703`) are refused, a missing folder and a plain name are not, with a fake agent and a stub tmux so no real agent or tmux server starts.
- `packages/core/docs/commands/doctor.md`, `packages/orchestration/docs/coordinator.md`, `orchestration.md`, `arthur.config.example.ts`, `docs/setup.md`: the umask and the socket folder rule; the systemd unit's `UMask` line removed, since Arthur sets it itself.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1147/1214 passed.

## Left open

- Tickets from findings: AR0523 (F4).
