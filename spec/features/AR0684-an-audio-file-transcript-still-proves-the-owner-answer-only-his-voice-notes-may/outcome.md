# AR0684 - Outcome

- Merged: 2026-11-10, `cd7c1eef`
- Branch: arthur/2026-11-10-worker-186b16e8
- Reviews: none
- Cost: worker $0.84, reviews $0.00; review rounds 0

## What went in

- packages/orchestration/src/decision-proof.ts: only a `[voice <n> s] <transcript> (/<path>)` line counts as the owner's own words; an `[audio …]` transcript line is dropped like any other file's line (AR-D616).
- packages/orchestration/test/decisions.test.ts: an audio file's transcript in the owner's message is now refused as proof; the voice transcript rows, including the decimal-length one, still prove an answer.
- packages/orchestration/docs/commands/decision.md: states that only a voice note's transcript counts and that an audio file's transcript never proves an answer.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1644/1715 passed.

## Left open

- Findings: none; no findings.md on this ticket.
