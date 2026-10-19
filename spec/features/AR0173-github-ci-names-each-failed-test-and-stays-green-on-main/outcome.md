# AR0173 - Outcome

- Merged: 2026-10-19, `a1fbecb`
- Branch: h/2026-10-19-ar0173-ci-green-ddd65831
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $19.19, reviews $1.98; review rounds 2

## What went in

- `ci` runs on `ubuntu-24.04`, in separate install, check and test steps; a failed test is annotated with its name and the first lines of its error, readable without a token.
- The wrapper starts the agent with `oom_score_adj` 1000, so at a memory cap the kernel kills the agent, not the wrapper, and the job ends `limit: memory` instead of never ending.
- Tests read only whole lines of a JSONL file being appended; the doctor cut test allows for the timer clock; the memory cap test asserts the job's end reason.
- Evidence: 30 of 30 full runs on 2 cores, and 6 green CI runs in a row after the last fix.

## Checks on main

- `npm run check`: passed.
- `npm test`: 577/577 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none open; no ticket made.
