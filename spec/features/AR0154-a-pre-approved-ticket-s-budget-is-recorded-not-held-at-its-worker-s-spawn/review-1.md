# AR0154 - Review 1

- Job: 2026-10-19-review-ar0154-orchestrat-1ebc111b
- Branch: h/2026-10-19-ar0154-orchestration-bat-095bb636
- Commit reviewed: f5a2956b1dd21b2a69d82b98cb5443c6ce73745a
- Verdict: PASS

## Final message

## Findings

None blocking.

## Notes

- Line-budget raises (core 5448→5451, orchestration 1213→1260, session 849→873, core/testing 344→349) are explained with per-ticket reasons in `test/structure.test.ts`'s comment block, but none of the touched tickets has a matching Decisions line recording the raise (repo convention elsewhere, e.g. AR0017/AR0018, has the coordinator add that line at merge time). Not blocking; normally added when the coordinator accepts the branch.
- AR0154's open finding F1 (`jobs.ts:164`: a free-model job gets `budgetUsd: 0`, which AR0154's check reads as "no limit" and refuses on a pre-approved ticket) is correctly filed as `open` in `findings.md`, not silently dropped; it's a real but separate interaction, out of this ticket's literal Done means.
- AR0185 ships with no automated test (role-prompt doc line only); worker's reasoning (a wording-pin test would violate the styleguide's "never re-pin wording" rule, and no character-ceiling test exists for role files in this repo) is sound, and the referenced `arthur init`/`arthur spawn --kind onboarding` commands do exist in `packages/projects/src/init.ts` and `onboarding.ts` exactly as described.

## Checks run

- `npm ci` — clean install, 15 packages.
- `npm run check` — `tsc`, clean, no errors.
- `npm test` — 679/679 passed (matches worker's claim).
- Mutation tests (throwaway edits in this worktree, each reverted and confirmed via `git status --short` clean afterward):
  - AR0154: made `overBudget` always return `undefined` → `plans.test.ts`'s pre-approval test failed (missing expected rejection). Caught.
  - AR0155: removed the `queueLock` wrap around `preApprove` → the two-at-once test failed (`['fulfilled','fulfilled']` instead of one rejected). Caught.
  - AR0156: dropped `own` from `asked ?? own ?? fallback` → the JSON-block-budget test failed (worker spawned at $1 instead of the ticket's $2.5). Caught.
  - AR0165: inverted the same-reason suppression (`if (false) return;`) → start-notice test failed ("the same reason once": 2 ≠ 1). Caught.
  - AR0168: dropped `...(plugin.after ?? [])` from the cycle/order traversal in `host.ts` → both the `after` ordering test (real `schedule.register` throw) and the cycle-detection test failed. Caught.
  - AR0175: removed the try/catch/notice around `restart()` in `restart.ts` → the new "/restart that throws" test timed out waiting for the notice. Caught.
  - AR0135: reverted `queue()`'s file name to plain `seq` (no time) → the "new event of that number after a cut log" unit test failed with `ENOENT` on the old-style path. Caught (worker's own final message correctly flags this as the only partial-proof spot: the reused-107 integration scenario uses hand-crafted filenames that bypass `queue()`, so that specific sub-case isn't mutation-provable, which the worker disclosed rather than hid).
- Verified boundaries: `@arthur/core/lock` and `@arthur/core/testing` are both published exports; the autopilot lock file lives under orchestration's own `host.folder`; no plugin-to-plugin import; `silent.ts` untouched as instructed.
- Verified all 10 commits are `git commit -s` signed off, Conventional-Commits with the correct ticket-id scope, and each commit's own `BUDGETS` delta matches only its own ticket (checked commit-by-commit).
- Spot-checked docs (`docs/commands/coordinator.md`, `docs/commands/run.md`, `docs/commands/config.md`, `docs/session.md`, `docs/commands/restart.md`) against the corresponding code changes — all consistent.

PASS
