# AR0671 - Outcome

- Merged: 2026-11-11, `68ff7073`
- Branch: arthur/2026-11-10-worker-4b7cab02
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS, review-4.md PASS
- Cost: worker $42.38, reviews $4.02; review rounds 4

## What went in

- packages/delivery/test/merge-main.test.ts: main's change to the merge-lock test, with its `delivery.merging` checks
- packages/session/test/restart.test.ts: main's test of the fresh start held by a running merge
- packages/session/test/restart-command.test.ts: main's test of `/restart` refused or stopped by a running merge
- packages/session/test/service.test.ts: main's test of the restart due held by a running merge under the service
- test/structure.test.ts: session line budget 960
- .agents/arthur/criteria/verify.md: not described
- .github/workflows/ci.yml: not described
- packages/core/roles/worker.md: not described
- packages/core/src/job-memory.ts: not described
- packages/core/src/job-scope.ts: not described
- packages/core/src/wrapper.ts: not described
- packages/core/test/doctor.test.ts: not described
- packages/core/test/fake-machine.ts: not described
- packages/core/test/job-machine.test.ts: not described
- packages/core/test/machine-control.test.ts: not described
- packages/core/test/machine-log.test.ts: not described
- packages/core/test/machine-spawn.test.ts: not described
- packages/core/test/machine-sync.test.ts: not described
- packages/core/test/machine.test.ts: not described
- packages/core/test/scope.test.ts: not described
- packages/delivery/roles/reviewer.md: not described
- packages/delivery/test/auto-merge.test.ts: not described
- packages/delivery/test/hand-back.test.ts: not described
- packages/delivery/test/merge-command.test.ts: not described
- packages/delivery/test/merge-outcome.test.ts: not described
- packages/delivery/test/merge-setup.ts: not described
- packages/delivery/test/merge-steps.test.ts: not described
- packages/delivery/test/merge.test.ts: not described
- packages/delivery/test/pass-forward.test.ts: not described
- packages/delivery/test/review-setup.ts: not described
- packages/delivery/test/review.test.ts: not described
- packages/delivery/test/ticket-prune.test.ts: not described
- packages/discord/src/discord.ts: not described
- packages/discord/src/gateway.ts: not described
- packages/discord/test/fake-discord.ts: not described
- packages/discord/test/gateway.test.ts: not described
- packages/github/test/fake-github.ts: not described
- packages/github/test/github.test.ts: not described
- packages/machines/test/machines.test.ts: not described
- packages/orchestration/test/hand-over.test.ts: not described
- packages/orchestration/test/inbox-setup.ts: not described
- packages/orchestration/test/inbox-start.test.ts: not described
- packages/orchestration/test/inbox.test.ts: not described
- packages/session/src/handoff-extension.ts: not described
- packages/session/src/session.ts: not described
- packages/session/test/compaction.test.ts: not described
- packages/session/test/restart-setup.ts: not described
- packages/session/test/session-setup.ts: not described
- packages/session/test/session.test.ts: not described
- packages/uptime/src/site-check.ts: not described
- packages/uptime/src/uptime.ts: not described
- packages/uptime/test/uptime.test.ts: not described
- spec/features/AR0671-tests-run-faster-no-real-waits-of-seconds-the-slowest-file-split-ci-in-parallel/findings.md: not described

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1678/1749 passed.

## Left open

- Deferred (client summary): F4. The 30 001 px page test does work, not a wait
- Deferred (client summary): F5. Two session tests run 3 to 4 s, mostly from the agents they start
