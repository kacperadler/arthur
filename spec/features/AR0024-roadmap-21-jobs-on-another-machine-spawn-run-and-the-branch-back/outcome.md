# AR0024 - Outcome

- Merged: 2026-10-16, `113b11d`
- Branch: h/2026-10-16-ar0024-jobs-on-another-m-bc3c12f4
- Reviews: review-1.md PASS
- Cost: worker $7.06, reviews $1.55; review rounds 1

## What went in

- `job-machine.ts`, `remote-job.ts` (new): `host.jobs.registerMachine`, `local` always; `arthur spawn --machine` and `jobs.place`; a job on another machine over `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes`: version check, bare repo and base commit pushed when missing, worktree and record there, sweep copies the record back, branch fetched at the end; `host.jobs.run(machine, argv)` runs one command there, each word quoted; `prepare` stays in the main process. Core +296 of 350.

## Checks on main

- `npm run check`: passed.
- `npm test`: 299/299 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0088 (F1), AR0089 (F2).
