# AR0566 - Five job roles tell the agent to wait on proc://, which a job sandbox cannot reach

```json
{
  "id": "AR0566",
  "title": "Five job roles tell the agent to wait on proc://, which a job sandbox cannot reach",
  "date": "2026-10-30",
  "budget": 2
}
```

## Description

The reviewer, auditor, retro, planner and plan-reviewer roles tell their agent to poll a background process through `proc://`, which the job sandbox refuses. After this, they are told what the worker is told: run each check in one bash call with a long enough timeout, so a review or audit gets its test result.

## Goal

Reviewers, planners, auditors and retros are told to use a process mechanism their sandbox refuses, and none is told that a call without a timeout dies at 300 s, before a suite that takes 11 to 16 minutes ends.

Evidence:
- `packages/delivery/roles/reviewer.md:34`, `packages/manage/roles/auditor.md:47`, `packages/manage/roles/retro.md:55`, `packages/orchestration/roles/planner.md:53`, `packages/orchestration/roles/plan-reviewer.md:27`: each says to "alternate a foreground `sleep 30` with `read proc://<id>` until it reads `completed`".
- `packages/core/docs/commands/spawn.md:118`: "No process in the sandbox can make a Unix stream or seqpacket socket". omp's process broker is such a socket.
- AR0541 F1 and this audit both hit `Failed to start daemon broker ... connect EACCES`.
- `packages/core/src/job-omp.yml:3-7`: background moves are off since AR0541.
- `packages/core/roles/worker.md:19` is the only role with the 1800 s timeout rule; the full suite takes 684 to 972 s (AR0401 review-2, AR0541 F2).

- Kind: fix

## Done means

- None of the five roles names `proc://` or a `sleep 30` loop; each carries the worker's timeout rule (one bash call, `timeout` 1800, up to 3600), in the same words as `packages/core/roles/worker.md:19`.
- `launch: { enabled: false }` is added to `packages/core/src/job-omp.yml` only if a real `omp -p --config` run confirms the key; the final message shows that run either way.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/delivery/roles/reviewer.md`
- `packages/manage/roles/auditor.md`
- `packages/manage/roles/retro.md`
- `packages/orchestration/roles/planner.md`
- `packages/orchestration/roles/plan-reviewer.md`
- `packages/core/src/job-omp.yml`: only if the key is confirmed.

Out:
- The coordinator's own session stays as it is.
- The worker's role is unchanged.

## Decisions

- 2026-10-30: Source: audit spec/quality/2026-10-30.md
- 2026-10-30: AR0566 approved; its worker starts now; the owner: "AR0566, AR0567, AR0568 - approve" (AR-D356)
