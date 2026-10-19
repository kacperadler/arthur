# AR0164 - Outcome

- Merged: 2026-10-19, `1bf2a8a`
- Branch: h/2026-10-19-ar0164-4ef46084
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $1.44, reviews $0.57; review rounds 2

## What went in

- The notice sent after 3 coordinator turns in a row end without a reply now redacts credentials in omp's error (vendor keys, environment variable values, long tokens), with the same rules as the `turn failed` notice; its wording is otherwise unchanged.
- Orchestration keeps its own copy of `credential.ts`; each copy's comment says to change both together.

## Checks on main

- `npm run check`: passed.
- `npm test`: 562/562 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
