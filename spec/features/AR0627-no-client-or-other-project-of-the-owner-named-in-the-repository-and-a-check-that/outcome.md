# AR0627 - Outcome

- Merged: 2026-11-04, `3b0bb390`
- Branch: arthur/2026-11-04-worker-331520f3
- Reviews: review-1.md PASS
- Cost: worker $4.80, reviews $0.48; review rounds 1

## What went in

- .githooks/commit-msg: the commit-msg hook that runs `test/other-projects.ts` on the commit's message and its files.
- test/other-projects.ts: the check: names from the main checkout's `projects/` (not `arthur`), matched against tracked paths and contents and commit messages, a sign-off's own author or committer address exempt (AR-D501); also runs as the commit-msg hook.
- test/other-projects.test.ts: checks Arthur's own tracked files and the commits HEAD brings, and tests the check, the merge range, the sign-off exemption and the hook against a made-up project folder.
- docs/setup.md: one paragraph on the check, what `npm test` and `arthur merge` refuse, the sign-off exemption, and the `core.hooksPath .githooks` line.
- spec/schedule.json: the past one-off entry that named another project removed.
- spec/features/AR0256-roadmap-66-arthur-plugin-new/review-1.md: the sign-off address reworded with a made-up domain.
- spec/features/AR0256-roadmap-66-arthur-plugin-new/review-2.md: the sign-off address reworded with a made-up domain.
- spec/features/AR0263-roadmap-83-findings-what-happens-to-them-per-project/review-2.md: the sign-off address reworded with a made-up domain.
- spec/features/AR0265-no-health-line-for-a-finished-audit-that-was-never-filed/review-2.md: the sign-off address reworded with a made-up domain.
- spec/features/AR0280-roadmap-68-evals-the-scenarios/review-1.md: the author address reworded with a made-up domain.
- spec/features/AR0604-plan-the-docker-plugin-and-the-core-cleanup-hook-roadmap-70-to-72/plan.md: both projects named with made-up names.
- spec/features/AR0607-runbook-what-the-coordinator-checks-and-does-in-order-when-a-project-site-is/plan.md: the site and the class's match words reworded with made-up ones.
- spec/features/AR0627-no-client-or-other-project-of-the-owner-named-in-the-repository-and-a-check-that/findings.md: findings F1 to F6, F4 fixed.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1477/1548 passed.

## Left open

- Deferred (client summary): F1. The spec: commit of a merge is checked only after it is pushed
- Deferred (client summary): F2. Other projects of the owner that are not in projects/ are not checked
- Deferred (client summary): F3. A project named with a common word fails Arthur's own npm test
- Deferred (client summary): F5. A plan names the addresses of two servers
- Deferred (client summary): F6. On another machine the check has no names
- Deferred (client summary): F7. the `spec: <id> merged` commit is made with hooks off
- Deferred (client summary): F8. when `projects/` is missing or can't be read (a job on another machine, a sandbox that hides it), the check sees no names and passes without saying so
