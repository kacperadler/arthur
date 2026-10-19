# AR0213 - Outcome

- Merged: 2026-10-19, `bd3400d`
- Branch: h/2026-10-19-ar0190-core-batch-2-27eddfc2
- Reviews: review-1.md PASS, review-2.md PASS, review-3.md PASS
- Cost: worker $12.45, reviews $4.42; review rounds 3

## What went in

- A pre-approved ticket's worker on a free model starts: its budget of 0 passes the check, paid models are checked as before; the record keeps `free` (AR0213).
- `arthur continue` re-runs the plugins' prepares with `continued` true, so a provider model gets its variables; commit-rules and projects return at once; the caps in force now are asked again; `jobs.ts` split, `Kind` in `job-kinds.ts` (AR0190).
- `host.code` takes each plugin's package from its own `module` (AR0161).
- A registered schedule entry may run its plugin's own code, a third kind `run`, claimed once per slot (AR0169).

## Checks on main

- `npm run check`: passed.
- `npm test`: 737/737 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
