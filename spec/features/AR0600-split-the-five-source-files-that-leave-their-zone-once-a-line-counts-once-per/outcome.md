# AR0600 - Outcome

- Merged: 2026-11-01, `2320de78`
- Branch: arthur/2026-10-31-worker-20dd796d
- Reviews: review-1.md PASS
- Cost: worker $3.57, reviews $0.32; review rounds 1

## What went in

- packages/core/src/worktree-guard.ts: keeps only the guard extension, `worktreeRefusal` and `editPaths`; imports `bashRefusal` and `refusal`.
- packages/core/src/bash-refusal.ts: new; holds `bashRefusal` and its command lists and refusal messages, moved unchanged from worktree-guard.ts.
- packages/core/src/path-refusal.ts: new; holds `refusal`, `inside` and the ticket refusal message, moved unchanged from worktree-guard.ts.
- packages/core/src/jobs.ts: no longer holds the `Jobs` type; imports it from host-jobs.ts.
- packages/core/src/host-jobs.ts: new; the `Jobs` type (what a plugin sees as `host.jobs`), moved unchanged from jobs.ts.
- packages/core/src/plugin.ts: imports `Jobs` from host-jobs.ts.
- packages/core/src/shell-words.ts: no longer holds the escape helpers or `closing`; imports them.
- packages/core/src/shell-escapes.ts: new; `quoted`, `literal`, `decodeEscapes` and their constants, moved unchanged from shell-words.ts.
- packages/core/src/shell-closing.ts: new; `closing`, moved unchanged from shell-words.ts.
- packages/core/src/env-refusal.ts: imports `decodeEscapes` and `literal` from shell-escapes.ts.
- packages/core/src/git-writes.ts: its comment names bash-refusal.ts where the guard counts config set earlier.
- packages/core/test/worktree-guard.test.ts: one added entry checks that `bash`, `zsh`, `dash` and `ksh` `-c` strings are each read and refused.
- packages/delivery/src/delivery.ts: no longer holds the review wake; imports `recorded`, `named` and `wake`.
- packages/delivery/src/review-wake.ts: new; the review wake (`Seen`, `recorded`, `named`, `wake`), moved unchanged from delivery.ts.
- packages/orchestration/src/decision-log.ts: no longer holds `ask`, `answer` and `close`; now exports `stamp`.
- packages/orchestration/src/decision-writes.ts: new; `ask`, `answer` and `close`, moved unchanged from decision-log.ts.
- packages/orchestration/src/decision-class.ts: imports `ask` from decision-writes.ts.
- packages/orchestration/src/decision-commands.ts: imports `answer`, `ask` and `close` from decision-writes.ts.
- packages/orchestration/src/decision-hooks.ts: imports `ask` and `close` from decision-writes.ts.
- test/structure.test.ts: budgets for core 6628, delivery 1923 and orchestration 2584, raised only by the lines the split adds.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1384/1453 passed.

## Left open

- Findings: none; no findings.md on this ticket.
