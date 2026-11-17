# AR0719 - Outcome

- Merged: 2026-11-17, `6bc8dfba`
- Branch: arthur/2026-11-17-worker-1db76016
- Reviews: none
- Cost: worker $5.48, reviews $0.00; review rounds 0

## What went in

- spec/features/AR0719-npm-test-takes-about-12-minutes-of-3-busy-cores-find-which-test-files-and-which/report.md: measures `npm test` on `793a1927`: five whole-run timings with and without Node's compile cache, every file's CPU and wall time run alone (top 20 with share), the child processes the suite starts by what they run with their CPU, five ticket-ready proposals (P1–P5) with savings and risks, and the tracer's source.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1821/1892 passed.

## Left open

- Findings: none; no findings.md on this ticket.
