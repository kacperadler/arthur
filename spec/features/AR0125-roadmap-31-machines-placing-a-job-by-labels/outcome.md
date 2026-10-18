# AR0125 - Outcome

- Merged: 2026-10-18, `5dd1733`
- Branch: h/2026-10-18-ar0125-machine-placement-7dd32646
- Reviews: review-1.md PASS, review-2.md PASS; merged unreviewed (--unreviewed): no PASS on 5df3a21 (last PASS: 0aab2e1, 1 commits since)
- Cost: worker $10.73, reviews $2.29; review rounds 2

## What went in

- `packages/machines/src/machine-place.ts` (new): picks the machine for each spawn from the labels the job needs (ticket, project, `--requires`), skipping offline and full machines, the most room from `resources.free` winning.
- `packages/machines/src/machines.ts`, `machine-options.ts`, `machine-check.ts`: the plugin provides `jobs.place`; `maxJobs` counts jobs in a run.
- `packages/core/src/spawn-command.ts`: `arthur spawn --requires os=..,arch=..,tools=..`, wrong input exits 2.
- `packages/core/src/jobs.ts`, `job-machine.ts`: every spawn asks `jobs.place`; `--machine` is checked against labels; no placing plugin with labels needed refuses.
- Docs (`machines.md`, `spawn.md`, projects' `requires`), README, `arthur.mmd`; `test/structure.test.ts`: core 4764, machines 375.

## Checks on main

- `npm run check`: passed.
- `npm test`: 440/440 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0138 (F1), AR0139 (F2).
