# AR0126 - Outcome

- Merged: 2026-10-18, `1bde258`
- Branch: h/2026-10-18-ar0126-resources-per-job-eaa337bc
- Reviews: review-1.md PASS, review-2.md PASS, review-3.md PASS, review-4.md PASS; merged unreviewed (--unreviewed): no PASS on 7de4b00 (last PASS: f4b76a2, 1 commits since)
- Cost: worker $12.35, reviews $3.36; review rounds 4

## What went in

- `packages/resources/` (new plugin): `jobs.limits` gives each job its CPU and memory caps from the config; docs and tests.
- `packages/core/src/job-scope.ts`: a job runs in a systemd scope with `CPUQuota` and `MemoryMax`, `OOMPolicy=continue` only on systemd 253 or later.
- `packages/core/src/job-memory.ts` (new): without a user manager, a job over its memory cap is stopped within one 10 s sample.
- `packages/core/src/jobs.ts`, `job-control.ts`, `job-record.ts`, `wrapper.ts`, `process-table.ts`: the caps are asked on spawn, saved in the job record and kept on continue, with one notice per machine that cannot cap.
- `packages/core/src/remote-job.ts`, `machine-sync.ts`: caps reach a job on another machine.
- `packages/core/src/config.ts`, `plugin.ts`, `host.ts`: the plugin API's `check(options, core)`; `perFeature` and `keepFree` refused until entries 33, 34 and 69.
- Docs (`spawn.md`, `remote-job.md`), README, `arthur.mmd`; `test/structure.test.ts`: core 4751, resources 42.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 434/434 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
