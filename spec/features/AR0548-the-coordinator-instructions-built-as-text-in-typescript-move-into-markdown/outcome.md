# AR0548 - Outcome

- Merged: 2026-11-10, `b2152c78`
- Branch: arthur/2026-11-10-worker-00e9fdaf
- Reviews: review-1.md PASS
- Cost: worker $6.86, reviews $0.74; review rounds 1

## What went in

- packages/session/roles/coordinator/handoff-compact.md: the handoff request before a compaction, `{handoff}` the path
- packages/session/roles/coordinator/handoff-restart.md: the handoff request before a restart that goes on with the conversation
- packages/session/roles/coordinator/handoff-fresh.md: the handoff request before a restart in a fresh conversation
- packages/session/src/handoff-extension.ts: sends the request from `handoff-<then>.md` beside it with the path filled in
- packages/session/test/handoff-extension.test.ts: the request's text word for word for each `then`, and the wording read from the file beside a copied extension
- packages/session/docs/session.md: step 2 of "The handoff" names the request's procedure files
- packages/github/roles/coordinator/ci-failed-worker.md: the `Why:` line of a failed CI run on a job's branch
- packages/github/roles/coordinator/ci-failed-owner.md: the `Why:` line of a failed CI run on a branch no job has
- packages/github/src/github.ts: builds the `Why:` line from the matching file, `{branch}`, `{project}` and `{job}` filled in
- packages/github/test/github.test.ts: `started()` takes the plugin factory; a copied package's custom `ci-failed-worker.md` wording reaches the wake
- packages/github/docs/github.md: names the `Why:` line's procedure files
- packages/delivery/roles/coordinator/review-failed.md: a FAIL review's wake line below the limit, with the hand-back
- packages/delivery/roles/coordinator/review-failed-limit.md: a FAIL review's wake line at the 4th FAIL
- packages/delivery/src/review-wake.ts: builds the FAIL line from the file beside the limit's procedure, the live values filled in
- packages/delivery/test/review-wake.test.ts: the FAIL line word for word at FAIL 1, 3 and 4, and custom wording with every placeholder, an unknown one and a `$&` value
- packages/delivery/docs/commands/review.md: names the FAIL line's procedure files
- packages/orchestration/roles/coordinator/reply-not-sent.md: the reminder that the reply above was not sent
- packages/orchestration/src/inbox-extension.ts: appends the reminder from `reply-not-sent.md` when a turn is resumed
- packages/orchestration/test/inbox.test.ts: the resumed turn's whole continuation, `continue: true` included
- packages/orchestration/docs/commands/coordinator.md: names the reminder's procedure file
- spec/features/AR0548-the-coordinator-instructions-built-as-text-in-typescript-move-into-markdown/findings.md: F1, no project override for coordinator procedures

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1622/1693 passed.

## Left open

- Deferred (client summary): F1. A project cannot override a coordinator procedure
