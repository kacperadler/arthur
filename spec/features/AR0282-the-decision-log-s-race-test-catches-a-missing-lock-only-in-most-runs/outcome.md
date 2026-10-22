# AR0282 - Outcome

- Merged: 2026-10-22, `d85fed6`
- Branch: h/2026-10-22-ar0282-fc59140c
- Reviews: review-1.md PASS
- Cost: worker $0.75, reviews $0.60; review rounds 1

## What went in

- `packages/orchestration/test/decisions.test.ts`: a child process holds the decision log's lock while `arthur decision ask` runs; the ask must wait and write after the holder's record, so a missing lock fails every run. The four-process race test stays, its setup shared in `demo()`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1023/1023 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
