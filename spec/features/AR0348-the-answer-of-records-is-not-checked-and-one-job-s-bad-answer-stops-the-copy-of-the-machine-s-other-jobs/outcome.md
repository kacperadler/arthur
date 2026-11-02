# AR0348 - Outcome

- Merged: 2026-11-02, `83adb63f`
- Branch: arthur/2026-11-02-worker-33f91ff1
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $2.68, reviews $0.50; review rounds 2

## What went in

- packages/core/src/machine-sync.ts: `refusal` checks a job's branch here and the shape of its `records` answer before anything is written; `syncMachine` copies each job in its own `try` and throws the collected `machine <name>: job <id>: <why>` lines after the other jobs were copied.
- packages/core/test/machine.test.ts: new table test of 13 bad answers, each run in both copy orders, asserting the named error, the bad job's unchanged record and the other job's copy, plus two bad jobs giving two lines; the record-file, branch and two fetch-refusal tests expect the new `job <id>: ` prefix.
- packages/core/docs/commands/spawn.md: the copy is per job; the shape a job's answer must have; a refusal names the machine, the job and what was sent; the branch and fetch refusal messages carry the new prefix.
- test/structure.test.ts: core line budget 7092 (main's 7069 plus this branch's 23).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1421/1492 passed.

## Left open

- Findings: none; no findings.md on this ticket.
