# AR0666 - The threat model says the coordinator runs with no sandbox and no worktree guard

```json
{
  "id": "AR0666",
  "title": "The threat model says the coordinator runs with no sandbox and no worktree guard",
  "date": "2026-11-08"
}
```

## Description

Option 1 of the AR0483 plan: `docs/deploy.md`'s threat model says plainly that the coordinator runs without the job sandbox or the worktree guard, so the owner's picture of what protects him is true.

## Goal

The approved AR0483 plan (spec/features/AR0483-the-coordinator-the-agent-that-reads-the-most-outside-text-runs-with-no-sandbox/plan.md at 380bf9ad, Option 1): the threat model in `docs/deploy.md` says "Code reaches main only through `arthur merge`" and limits outside text to jobs, while `supervise` in `packages/orchestration/src/coordinator.ts` starts `omp --auto-approve` with only the env guard, and `worktreeGuard` returns at once without `ARTHUR_JOB` (`packages/core/src/worktree-guard.ts`).

- Kind: docs

## Done means

- `docs/deploy.md`, "Threat model": a bullet says the coordinator runs without the sandbox or the worktree guard (AR0329), with every tool and the owner's SSH keys, only the env guard, and its prompt as its only bound against steering by outside text.
- The bullet "Code reaches main only through `arthur merge`" says it is a rule for jobs and a convention for the coordinator; the "Text from outside … reaches a job" bullet covers the coordinator too (named by their text, not line).
- No code; `npm run check` and `npm test` pass.

## Scope

In:
- `docs/deploy.md` (the Threat model section only)

Out:
- The sandbox itself: AR0667.

## Decisions

<!-- - YYYY-MM-DD: one decision the human made, in one line. -->
