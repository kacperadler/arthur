# AR0301 - Outcome

- Merged: 2026-10-23, `3691a8e`
- Branch: h/2026-10-22-ar0301-926c7f4e
- Reviews: review-1.md PASS
- Cost: worker $1.42, reviews $0.94; review rounds 1

## What went in

- `packages/core/src/lock.ts`: `release()` removes the lock with `rmSync(path, { force: true })`, so a lock a starting wrapper already removed counts as released and a refused `arthur continue` says its reason instead of `ENOENT`.
- `packages/core/test/job-control.test.ts`: holds the gap open (a fake `systemd-run` and a patched read) and proves the refusal survives the wrapper removing `continuing`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1036/1036 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
