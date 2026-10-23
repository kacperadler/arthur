# AR0315 - GitHub's own wake after a failed CI run names only the rerun

```json
{
  "id": "AR0315",
  "title": "GitHub's own wake after a failed CI run names only the rerun",
  "date": "2026-10-23"
}
```

## Description

for a branch with no delivery wait, github's wake ends `Why: arthur ci <branch> --project <project>; rerun it once: … --rerun`, naming the rerun and not `arthur continue` that `packages/github/docs/commands/ci.md` "What the coordinator does with it" asks for when the failure is in the branch's own code. AR0314 changed only delivery's wake (`packages/delivery/src/ci-wait.ts`). The eval `packages/github/evals/ci-failed` checks the coordinator continues anyway on this wording.

## Goal

The github plugin's own wake after a failed CI run names both moves, as delivery's does since AR0314: `arthur continue` for a failure in the branch's own code, one rerun for a transient one.

- Kind: feat

Evidence:
- `packages/github/src/github.ts:93`
- Found by: 2026-10-23-ar0314-79966166 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: for a branch `arthur/<job>`, end the second line as delivery's does: `then a failure in the branch's own code goes back to its worker: arthur continue <job> '<the failed step and its lines>'; one that looks transient … is rerun once: … --rerun`; for `main`, which has no worker, keep the rerun and name the owner. Update `docs/github.md`, its tests and the eval's turn.
- `npm test` and `npm run check` pass.

## Scope

In:
- for a branch `arthur/<job>`, end the second line as delivery's does: `then a failure in the branch's own code goes back to its worker: arthur continue <job> '<the failed step and its lines>'; one that looks transient … is rerun once: … --rerun`; for `main`, which has no worker, keep the rerun and name the owner. Update `docs/github.md`, its tests and the eval's turn.

## Decisions

- 2026-10-23: Source: F1 of AR0314
- 2026-10-23: Coordinator (free hand, finding ticket) approved.
- 2026-10-23: github's line budget raised 630 → 633 (`test/structure.test.ts`) for the job looked up by its branch and the worker-or-owner clause in github.ts.
