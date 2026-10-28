# AR0544 - Findings

Notes from the reviews of AR0544, settled at the merge.

## F1. The 15 s lower bound cannot catch a kill that comes a little early

- Kind: test
- Found by: 2026-10-28-review-b0c47e07 (reviewer), 2026-10-28
- Where: `packages/delivery/test/merge.test.ts:608`
- What: the bound is on the whole merge, install and `npm run check` included; with the limit halved to 7.5 s the merge still took 14 454 ms on a busy host. The `timed out after 15 s` text pins the setting.
- Status: deferred (client summary)

## F2. Three core timeout tests fail when several full test runs share the host

- Kind: test
- Found by: 2026-10-28-review-b0c47e07 (reviewer), 2026-10-28
- Where: `packages/core/test/limits.test.ts`
- What: at a load of about 74 three timeout tests failed; they pass alone. The first merge of this branch was also stopped by the merge step's limit at that load.
- Status: dropped (out of this ticket's scope: other tests' timing under load)
