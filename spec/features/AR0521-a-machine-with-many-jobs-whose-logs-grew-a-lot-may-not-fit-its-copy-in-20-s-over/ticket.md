# AR0521 - A machine with many jobs whose logs grew a lot may not fit its copy in 20 s over a slow link, and counts as offline

```json
{
  "id": "AR0521",
  "title": "A machine with many jobs whose logs grew a lot may not fit its copy in 20 s over a slow link, and counts as offline",
  "date": "2026-10-27"
}
```

## Description

F2 of AR0509 (spec/features/AR0509-the-sweep-s-copy-from-another-machine-has-no-size-or-time-bound-so-one-machine/findings.md).

- Kind: fix
- Found by: 2026-10-27-worker-61d50fad (worker), 2026-10-27
- Where: `packages/core/src/remote-job.ts:23` (`LOG_BYTES`, per job), `packages/core/src/machine-sync.ts:29` (`COPY_SECONDS`)
- What: `records` caps the log at 256 KiB per job, not per answer: ten jobs each behind by that much send about 2.5 MiB (more with JSON escaping), which needs about 1 Mbit/s to arrive within the 20 s limit. Below that every sweep times out, the machine counts as unreachable, nothing is copied (`synced` does not move), and its jobs end `failed: machine offline` past the grace although the machine answers. [INFERENCE: arithmetic from the two constants; not run over a slow link.]
- Suggestion: a budget for the whole answer as well, shared out among the jobs asked, so a copy always moves on; or a limit that grows with the bytes asked. Out: the per-job cut, which stays.

## Goal

A slow link to another machine must not make it count as offline: the sweep's copy of job records is bounded per answer, not per job, so a machine with many jobs behind is still copied within the time limit (evidence in the Description: `remote-job.ts:23`, `machine-sync.ts:29`).

- Kind: fix

## Done means

- The bytes one copy answer carries are capped in total (not only per job), so the answer fits the copy's time limit on a slow link; what does not fit comes in the next sweep.
- A test with many jobs whose logs grew past the cap sees one bounded answer, `synced` moving forward, and no job failed as offline; it fails without the change.
- The project's checks pass.

## Scope

In:
- `packages/core/src/remote-job.ts`, `packages/core/src/machine-sync.ts` and their tests.

Out:
- Other parts of the machine sweep.

## Decisions

- 2026-10-27: Source: F2 of AR0509
