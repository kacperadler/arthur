# AR0534 - Findings

Notes from the reviews of AR0534, settled at the merge.

## F1. A backslash path to the secrets file is skipped

- Kind: security
- Found by: 2026-10-28-review-bdd6d5f1 (reviewer), 2026-10-28
- Where: `packages/delivery/src/review-needed.ts:15`, `packages/core/src/env-refusal.ts:13`
- What: the shared lookbehind reads `C:\proj\.env` as an escaped dot, so a changed line naming the file by a backslash path gets no review for that reason; the core guard has the same gap.
- Status: deferred (client summary)

## F2. `.ENV` in capitals is not matched

- Kind: fix
- Found by: 2026-10-28-review-f219a00b (reviewer), 2026-10-28
- Where: `packages/delivery/src/review-needed.ts:15`
- What: `DOT_ENV` has no `i` flag while the core's `NAME` has; true before this branch.
- Status: deferred (client summary)
