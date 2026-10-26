# AR0452 - `arthur take-main` takes an owner's decision of another project

```json
{
  "id": "AR0452",
  "title": "`arthur take-main` takes an owner's decision of another project",
  "date": "2026-10-26"
}
```

## Description

F2 of AR0441 (spec/features/AR0441-any-merge-commit-on-main-resets-the-baseline-one-a-job-made-included/findings.md).

- Kind: security
- Found by: 2026-10-26-worker-3b5515b3 (worker), 2026-10-26
- Where: `packages/orchestration/src/decision-use.ts:43`, `packages/delivery/src/take-main.ts:53`
- What: `decision.owner` matches a decision to its use by ticket, else by job; for an ask with neither, as `arthur take-main` sends, any answered `merge` decision of no ticket and no job passes, whatever project its id's prefix names. So `arthur take-main --project shop --decision AC-D3` records shop's main on a decision the owner took for acme. Read from the lines named; not run.
- Suggestion: give `decision.owner` the project the use acts on (`project` in `Use`) and refuse a decision whose prefix names another, in orchestration's `refusal`; delivery passes `found.name`.

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-26: Source: F2 of AR0441
