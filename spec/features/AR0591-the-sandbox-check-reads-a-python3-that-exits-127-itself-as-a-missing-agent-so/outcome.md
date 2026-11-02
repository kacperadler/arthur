# AR0591 - Outcome

- Merged: 2026-10-30, `ee38ee83`
- Branch: arthur/2026-10-30-worker-063d5147
- Reviews: review-1.md PASS
- Cost: worker $0.88, reviews $0.36; review rounds 1

## What went in

- packages/core/src/job-sandbox.ts: `noSandbox` treats the agent as missing only when the probe's own shell prints `missing` and exits 127; any other 127, such as from a broken `python3` shim, is a sandbox failure, refused unless `core.jobs.unsandboxed` is on.
- packages/core/test/sandbox.test.ts: new test with a `python3` that exits 127 itself and a real agent: refused without the opt-in, runs bare with the reason logged when opted in.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1321/1389 passed.

## Left open

- Findings: none; no findings.md on this ticket.
