# AR0597 - A job that rewrites its record's project, worktree or root gets another project unhidden, or writes outside its worktree, after arthur continue

```json
{
  "id": "AR0597",
  "title": "A job that rewrites its record's project, worktree or root gets another project unhidden, or writes outside its worktree, after arthur continue",
  "date": "2026-10-31"
}
```

## Description

A job's agent can write its own record folder, and the next run of that job (`arthur continue`) builds its sandbox from the record's `project`, `worktree` and `root`. An agent that rewrites `project` gets another project's checkout and folder unhidden on its next run; one that rewrites `worktree` or `root` may write wherever it points. After this ticket a run builds its sandbox only from values the agent cannot have changed.

## Goal

Source: finding F1 of AR0593 (`spec/features/AR0593-ar0589-t2-a-job-sees-only-its-own-project/findings.md`), confirmed by its review (`review-1.md` there): `packages/core/src/job-sandbox.ts:85`, `otherProjects` reads `project`, `worktree` and `root` from the job's record folder, which the agent can write. Traced from the code; no forged record was tried. Only `~/.ssh` was protected from this before (AR0508); AR0512 is the same weakness for the `guarded` file. The vision's worktree guard and "a job sees only its own project" (AR0589 plan) hold only while these fields cannot be forged.

- Kind: security

## Done means

- A test, in `packages/core/test/sandbox.test.ts`, where a job's agent rewrites its record's `project`, `worktree` and `root` between two runs, and the next run (`arthur continue`) still hides the other project and refuses writes outside the job's own worktree; it fails when the fix is removed.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/job-sandbox.ts` and the job runner's start of a run: take `project`, `worktree` and `root` from a place the job cannot write, or check them against it, as the worker judges smallest.
- Their tests; `packages/core/docs/commands/spawn.md` ("The sandbox") and `docs/deploy.md`'s threat model.

Out:
- The `guarded` file: AR0512.

## Decisions
- 2026-10-31: Approve AR0597 and add it to tonight's batch; the owner: "go with recomendations" (AR-D418)

