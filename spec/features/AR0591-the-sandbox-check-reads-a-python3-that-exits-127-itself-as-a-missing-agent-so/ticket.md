# AR0591 - The sandbox check reads a python3 that exits 127 itself as a missing agent, so the job runs without a sandbox

```json
{
  "id": "AR0591",
  "title": "The sandbox check reads a python3 that exits 127 itself as a missing agent, so the job runs without a sandbox",
  "date": "2026-10-30"
}
```

## Description

From the review of AR0572 (`spec/features/AR0572-defaults-t4-a-job-with-no-sandbox-refuses-to-start-unless-core-jobs-unsandboxed/review-1.md`, F1 of its findings.md). `packages/core/src/job-sandbox.ts:91,103` reads exit status 127 as "the agent is not there", whoever produced it. A `python3` that exits 127 itself (a broken shim such as `exec /opt/gone/bin/python3 "$@"`, or a pyenv shim with no Python version) therefore gets past the refusal: the reviewer reproduced it with `unsandboxed=false`, `sandboxed()` returned `["sh",["-c","echo ran"]]`, and the log said `no sandbox: the agent sh is not there`.

## Goal

A job whose sandbox probe fails for any reason other than the agent truly missing is refused, unless `core.jobs.unsandboxed` is on.

- Kind: security

## Done means

- A test with a `python3` that exits 127 on its own and a real agent: the job is refused with `no sandbox: ...`; it fails on the base and passes on the tip.
- The agent-missing case still starts bare and fails as before (its test still passes).
- `npm run check` and `npm test` pass; the core line budget change measured and named.

## Scope

In:
- `packages/core/src/job-sandbox.ts`, `packages/core/test/sandbox.test.ts`.

Out:
- Anything else of the sandbox.

## Decisions

- 2026-10-30: Source: F1 of AR0572
- 2026-10-30: Ticket and approve; the owner: "by recommendation: G5188" (AR-D395)
