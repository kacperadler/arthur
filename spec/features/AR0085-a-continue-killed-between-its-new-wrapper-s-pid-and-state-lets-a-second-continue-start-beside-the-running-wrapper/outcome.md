# AR0085 - Outcome

- Merged: 2026-10-17, `0a3ae06`
- Branch: h/2026-10-17-ar0085-continue-race-4b1ca44c
- Reviews: review-1.md PASS
- Cost: worker $1.66, reviews $0.50; review rounds 1

## What went in

- `packages/core/src/job-control.ts`: `wrappers(id)` finds a job's wrappers by command line, before they write `pid`; `continueJob` waits 5 s for all of them and refuses while one runs.
- `packages/core/src/job-records.ts`: the sweep keeps a job alive while any of its wrappers runs.
- `docs`: `continue.md` gives the wait and the refusal; `jobs.md` what counts as a wrapper.
- GitHub CI on the branch: ci and site passed.

## Checks on main

- `npm run check`: passed.
- `npm test`: 360/360 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
