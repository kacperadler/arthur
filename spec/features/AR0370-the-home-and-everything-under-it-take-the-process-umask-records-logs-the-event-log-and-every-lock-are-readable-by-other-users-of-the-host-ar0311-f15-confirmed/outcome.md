# AR0370 - Outcome

- Merged: 2026-10-23, `c7d9eab2`
- Branch: h/2026-10-23-ar0370-home-umask-acf62907
- Reviews: review-1.md PASS
- Cost: worker $2.74, reviews $0.50; review rounds 1

## What went in

- `packages/core/src/own-home.ts`: `ownHome` makes Arthur's home and drops its group and other bits (mode & 0700), so the home is its user's alone whatever the umask, while a read-only home stays read-only.
- `run.ts`, `requirements.ts`, `spawn-check.ts`, `remote-job.ts` (repo step) and `host.ts` (before the plugin folders) call it. Core's budget 5905.
- `docs/setup.md`: `UMask=0077` for the service; `doctor.md`, `remote-job.md` say the home is 0700.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1069/1069 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/40020058811

## Left open

- Findings: none; no findings.md on this ticket.
