# AR0123 - Review 1

- Job: 2026-10-18-review-ar0123-95c1f702
- Branch: h/2026-10-18-ar0123-f14e8e85
- Commit reviewed: 1296021a4bd280d41b5b1fa44e7293c6626014ae
- Verdict: PASS

## Final message

Findings: none.

Notes:
- `packages/orchestration/src/plans.ts:45` the `unapproved()` approval regex `APPROVED` requires the commit hash directly after `plan.md at `; a trailing punctuation-free hash is fine given the ticket's own Decisions format, no issue found.
- Worker's final message correctly flags that both the budget raises and the stricter plan guard needed owner sign-off; both are now recorded in the ticket's Decisions on `main`, exactly matching the numbers in the diff (verified below), so no outstanding approval gap.

Checks run (in this worktree, range `bea8dfb03cff9317c02db08950399b98e1585072..1296021a4bd280d41b5b1fa44e7293c6626014ae`):
- `npm ci`: installs cleanly.
- `npm run check`: exit 0, no diagnostics.
- `npm test`: 452/452 pass, 0 fail (matches worker's claim after their README/`arthur.mmd` fix; worker had not rerun the full suite — I did, and it's green).
- Line-budget arithmetic: orchestration src diff is `+132/-5` collapsing to net `+132` (board-commands +2, orchestration.ts +2, orchestration-options.ts 0, plan-file.ts +44, plans.ts +84 = 132); core src diff nets `+64` (job-kinds.ts +23, plugin.ts +2, ticket-command.ts +6, ticket-file.ts +33, cli.ts/jobs.ts net 0 = 64). Matches `test/structure.test.ts`'s new budgets (1007, 4828) and the ticket's Decisions line exactly — the raises buy only what's described, nothing extra.
- Mutation checks (throwaway edits, restored with `cp`/verified via `git status --short` clean afterward):
  - `plans.ts`: disabled the "owner approved plan.md" check (`if (false)` in place of the `commits.some` guard) → `plans.test.ts` fails exactly the approval test, confirms the stricter guard (ticket Decisions) is load-bearing and tested.
  - `ticket-file.ts`: disabled the finished/not-finished check → `plans.test.ts`'s "filing a failed plan job is refused" test fails, confirms the refusal is tested.
  - `plan-file.ts`: disabled the "already filed" guard in `filePlanReview` → the "never filed twice" test fails, confirms double-filing protection is tested.
- Verified doc/config coverage: `docs/commands/plan.md` (new), `ticket.md`, `coordinator.md` updated; `arthur.config.example.ts` gets `plan-reviewer` role and a comment on `plan.budgetUsd`; README feature table, `arthur.mmd`, and roadmap coverage ids (O9, O14, B6, B9, T10, G5) all line up with the new code.
- Verified package-boundary rules: `plans.ts`/`plan-file.ts` import only `@arthur/core/plugin` (published export); no plugin imports another plugin; core doesn't import a plugin; every touched `src/` file stays well under the 200-line cap (`jobs.ts` lands exactly at 200, matching the pre-existing "exactly 200 lines passes" rule).
- Spot-checked test hygiene: `plans.test.ts` uses `temporaryFolder()`, `fakeHost`, `fakeAgent`, a made-up fake `ssh` under its own `PATH` prefix, and fictitious repo `acme`/tickets `AC0001`/`AC0002` — no production resource names, no real client/project names.

PASS
