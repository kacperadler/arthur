# AR0011 - Outcome

- Merged: 2026-10-16, `dd9cacd`
- Branch: h/2026-10-16-ar0011-arthur-run-135ec570
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $3.67, reviews $1.26; review rounds 2

## What went in

- `packages/core/src/run.ts`: `arthur run` starts plugins in `requires` order, stays up until SIGTERM or SIGINT, stops them in reverse and exits 0; a throwing `start` or `stop` names the plugin, the others still stop, exit 1; one instance per home by `<home>/run.pid`.
- `lock.ts`: `takeLock` for a long-held lock; the lock file is `<pid> <bootId>`, a lock from an earlier boot is stale.
- `docs/deploy.md`: the systemd user service, linger and the restart drop-in.

## Checks on main

- `npm run check`: passed.
- `npm test`: 116/116 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
